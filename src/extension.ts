import * as vscode from 'vscode';
import * as path from 'path';
import { Commands, ContextKeys, EXTENSION_ID } from './constants';
import { fileExists } from './platform/paths';
import { detectProjects, selectProject, watchForProjectChanges } from './detection/projectDetector';
import { discoverEngines, findMatchingEngine, promptSelectEngine, createManualInstallation } from './detection/engineDiscovery';
import { detectBuildTools } from './detection/buildToolsDetector';
import { EngineLinkSettings } from './config/settings';
import { StatusBarManager } from './ui/statusBar';
import { createOutputChannel } from './ui/outputChannel';
import { generateCursorRules } from './ai/cursorRulesGenerator';
import { generateClaudeRules } from './ai/claudeRulesGenerator';
import { ensureClangdConfig } from './ai/clangdConfig';
import { startMcpServer, sendStateToMcp, stopMcpServer } from './ai/mcpServer';
import { resolveAIAssistant } from './ai/editorDetect';
import { EngineLinkTaskProvider } from './build/taskProvider';
import type { EngineLinkContext } from './types';

let context: EngineLinkContext;
let statusBar: StatusBarManager;
let settings: EngineLinkSettings;

export async function activate(extensionContext: vscode.ExtensionContext) {
  settings = new EngineLinkSettings();
  statusBar = new StatusBarManager();
  const outputChannel = createOutputChannel();

  context = {
    project: undefined,
    engine: undefined,
    buildTools: undefined,
    outputChannel,
    diagnosticCollection: vscode.languages.createDiagnosticCollection(EXTENSION_ID),
    lastBuildErrors: [],
    lastBuildResult: undefined,
  };

  outputChannel.appendLine('[EngineLink] Activating...');
  outputChannel.show(true); // Show output panel but don't steal focus

  // Register disposables
  extensionContext.subscriptions.push(
    outputChannel,
    statusBar,
    context.diagnosticCollection,
  );

  // Register task provider
  extensionContext.subscriptions.push(
    vscode.tasks.registerTaskProvider(
      EngineLinkTaskProvider.type,
      new EngineLinkTaskProvider(context, settings),
    ),
  );

  // Register commands
  registerCommands(extensionContext);

  // Run detection pipeline (auto compile_commands only on this first pass — see runDetectionPipeline)
  await runDetectionPipeline({ allowAutoCompileDb: true });

  // Resolve AI assistant
  const assistant = resolveAIAssistant(settings.aiAssistant);
  outputChannel.appendLine(`[EngineLink] AI assistant: ${assistant === 'cursor' ? 'Cursor' : assistant === 'claude' ? 'Claude Code' : 'none (manual MCP setup)'}`);

  // Start MCP server
  await startMcpServer(extensionContext.extensionPath, context, settings, assistant);

  // Watch for project changes
  extensionContext.subscriptions.push(
    watchForProjectChanges(() => runDetectionPipeline()),
  );

  // Watch for settings changes — also update toolbar immediately
  extensionContext.subscriptions.push(
    settings.onDidChange(() => {
      statusBar.update(context, settings);
      runDetectionPipeline();
    }),
  );

  outputChannel.appendLine('[EngineLink] Activated successfully.');
}

export function deactivate() {
  stopMcpServer();
}

/**
 * Run the full detection pipeline: project → engine → build tools.
 * @param options.allowAutoCompileDb — if true, may run UBT GenerateClangDatabase when settings allow and no compile_commands.json exists (activation only).
 */
async function runDetectionPipeline(options?: { allowAutoCompileDb?: boolean }) {
  const outputChannel = context.outputChannel;

  // 1. Detect projects
  outputChannel.appendLine('[EngineLink] Scanning for UE projects...');
  const projects = await detectProjects();

  if (projects.length === 0) {
    outputChannel.appendLine('[EngineLink] No .uproject files found.');
    await setContext(ContextKeys.ProjectDetected, false);
    context.project = undefined;
    statusBar.update(context, settings);
    return;
  }

  // Use settings override or auto-detect
  if (settings.projectFile) {
    context.project = projects.find((p) => p.uprojectPath === settings.projectFile) ?? projects[0];
  } else {
    context.project = projects.length === 1 ? projects[0] : await selectProject(projects);
  }

  if (!context.project) {
    await setContext(ContextKeys.ProjectDetected, false);
    statusBar.update(context, settings);
    return;
  }

  outputChannel.appendLine(`[EngineLink] Project: ${context.project.name} (${context.project.engineAssociation})`);
  await setContext(ContextKeys.ProjectDetected, true);

  // 2. Discover engines
  outputChannel.appendLine('[EngineLink] Discovering UE installations...');

  if (settings.engineRoot) {
    context.engine = await createManualInstallation(settings.engineRoot) ?? undefined;
  } else {
    const engines = await discoverEngines();
    outputChannel.appendLine(`[EngineLink] Found ${engines.length} engine(s).`);

    context.engine = await findMatchingEngine(context.project, engines);
    if (!context.engine && engines.length > 0) {
      outputChannel.appendLine('[EngineLink] No matching engine for EngineAssociation, prompting user...');
      context.engine = await promptSelectEngine(engines);
    }
  }

  if (context.engine) {
    outputChannel.appendLine(`[EngineLink] Engine: UE ${context.engine.version} at ${context.engine.root}`);
    await setContext(ContextKeys.EngineFound, true);
  } else {
    outputChannel.appendLine('[EngineLink] No engine found. Set enginelink.engineRoot in settings.');
    await setContext(ContextKeys.EngineFound, false);
  }

  // 3. Detect build tools
  outputChannel.appendLine('[EngineLink] Detecting VS Build Tools...');
  context.buildTools = await detectBuildTools(settings.vsBuildToolsPath || undefined);

  if (context.buildTools) {
    outputChannel.appendLine(`[EngineLink] Build Tools: ${context.buildTools.displayName} at ${context.buildTools.installationPath}`);
    await setContext(ContextKeys.BuildToolsFound, true);
  } else {
    outputChannel.appendLine('[EngineLink] VS Build Tools not found.');
    await setContext(ContextKeys.BuildToolsFound, false);
  }

  statusBar.update(context, settings);

  // Resolve AI assistant to decide which rule files to generate
  const assistant = resolveAIAssistant(settings.aiAssistant);

  if (context.project) {
    // Generate Cursor AI rules (.cursor/rules/*.mdc)
    if (assistant === 'cursor') {
      try {
        await generateCursorRules(context.project);
        outputChannel.appendLine('[EngineLink] Cursor rules generated in .cursor/rules/');
      } catch (err) {
        outputChannel.appendLine(`[EngineLink] Failed to generate Cursor rules: ${err}`);
      }
    }

    // Generate Claude Code rules (CLAUDE.md)
    if (assistant === 'claude') {
      try {
        await generateClaudeRules(context.project);
        outputChannel.appendLine('[EngineLink] Claude Code rules generated (CLAUDE.md)');
      } catch (err) {
        outputChannel.appendLine(`[EngineLink] Failed to generate Claude Code rules: ${err}`);
      }
    }
  }

  // clangd: suppress MSVC vs Clang intrinsic false positives in IDE
  if (context.project && settings.upsertClangdConfig) {
    try {
      const changed = await ensureClangdConfig(context.project.projectRoot);
      if (changed) {
        outputChannel.appendLine('[EngineLink] .clangd updated (clangd: suppress builtin_definition).');
      }
    } catch (err) {
      outputChannel.appendLine(`[EngineLink] Failed to update .clangd: ${err}`);
    }
  }

  // Optional compile_commands.json when enginelink.autoGenerateCompileCommands is enabled
  if (
    options?.allowAutoCompileDb &&
    settings.autoGenerateCompileCommands &&
    context.project &&
    context.engine
  ) {
    const compileDbPath = path.join(context.project.projectRoot, 'compile_commands.json');
    if (await fileExists(compileDbPath)) {
      outputChannel.appendLine(
        '[EngineLink] compile_commands.json already at project root; skipping auto-generation.',
      );
    } else {
      outputChannel.appendLine('[EngineLink] Auto-generating compile_commands.json...');
      const { generateCompileCommands } = await import('./commands/generateCommands');
      await generateCompileCommands(context, settings);
    }
  }

  // Update MCP server state
  sendStateToMcp(context, settings);
}

/**
 * Register all extension commands.
 */
function registerCommands(extensionContext: vscode.ExtensionContext) {
  const register = (id: string, handler: () => Promise<void> | void) => {
    extensionContext.subscriptions.push(vscode.commands.registerCommand(id, handler));
  };

  register(Commands.Build, async () => {
    const { executeBuild } = await import('./commands/buildCommands');
    await executeBuild(context, settings);
  });

  register(Commands.Rebuild, async () => {
    const { executeRebuild } = await import('./commands/buildCommands');
    await executeRebuild(context, settings);
  });

  register(Commands.Clean, async () => {
    const { executeClean } = await import('./commands/buildCommands');
    await executeClean(context, settings);
  });

  register(Commands.LaunchEditor, async () => {
    const { launchEditor } = await import('./commands/launchCommands');
    await launchEditor(context);
  });

  register(Commands.LiveCoding, async () => {
    const { triggerLiveCoding } = await import('./commands/liveCodingCommand');
    await triggerLiveCoding(context, settings);
  });

  register(Commands.GenerateCompileCommands, async () => {
    const { generateCompileCommands } = await import('./commands/generateCommands');
    await generateCompileCommands(context, settings);
  });

  register(Commands.SelectEngine, async () => {
    const engines = await discoverEngines();
    const picked = await promptSelectEngine(engines);
    if (picked) {
      context.engine = picked;
      await setContext(ContextKeys.EngineFound, true);
      statusBar.update(context, settings);
    }
  });

  register(Commands.SelectProject, async () => {
    const projects = await detectProjects();
    const picked = await selectProject(projects);
    if (picked) {
      context.project = picked;
      statusBar.update(context, settings);
    }
  });

  register(Commands.SelectBuildConfig, async () => {
    const configs = ['Debug', 'DebugGame', 'Development', 'Shipping', 'Test'];
    const picked = await vscode.window.showQuickPick(configs, {
      placeHolder: 'Select build configuration',
    });
    if (picked) {
      await vscode.workspace.getConfiguration(EXTENSION_ID).update('buildConfiguration', picked);
    }
  });

  register(Commands.SelectTarget, async () => {
    const targets = ['Editor', 'Game', 'Client', 'Server'];
    const picked = await vscode.window.showQuickPick(targets, {
      placeHolder: 'Select build target type',
    });
    if (picked) {
      await vscode.workspace.getConfiguration(EXTENSION_ID).update('buildTarget', picked);
    }
  });
}

function setContext(key: string, value: unknown): Thenable<void> {
  return vscode.commands.executeCommand('setContext', key, value);
}

/** Export context for MCP server and other modules */
export function getContext(): EngineLinkContext {
  return context;
}

export function getSettings(): EngineLinkSettings {
  return settings;
}

export function getStatusBar(): StatusBarManager {
  return statusBar;
}
