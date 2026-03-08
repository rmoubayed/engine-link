import * as vscode from 'vscode';
import { buildCommandLine, cleanCommandLine } from '../build/ubt';
import { spawnAsync, isUnrealEditorRunning } from '../platform/process';
import { parseBuildLine } from '../parsers/buildOutputParser';
import { getStatusBar, getSettings } from '../extension';
import type { EngineLinkContext, ParsedDiagnostic } from '../types';
import type { EngineLinkSettings } from '../config/settings';

/**
 * Execute a build.
 * Detects if Unreal Editor is running and adapts behavior:
 * - Offers Live Coding as the recommended option when editor is open
 * - Builds without -FromMsBuild to avoid hot-reload DLL lock errors
 */
export async function executeBuild(ctx: EngineLinkContext, settings: EngineLinkSettings) {
  if (!ctx.project || !ctx.engine) {
    vscode.window.showErrorMessage('EngineLink: No project or engine detected. Run detection first.');
    return;
  }

  try {
    const editorRunning = await isUnrealEditorRunning();

    // When the editor is running, offer Live Coding as the preferred option
    if (editorRunning) {
      const choice = await vscode.window.showInformationMessage(
        'EngineLink: Unreal Editor is running. Live Coding is recommended for faster iteration.',
        'Use Live Coding',
        'Build Anyway',
        'Cancel',
      );

      if (choice === 'Use Live Coding') {
        const { triggerLiveCoding } = await import('./liveCodingCommand');
        await triggerLiveCoding(ctx, settings);
        return;
      }
      if (choice !== 'Build Anyway') return;
    }

    const cmd = buildCommandLine(ctx.engine, ctx.project, {
      configuration: settings.buildConfiguration,
      targetType: settings.buildTarget,
      platform: settings.platform,
      editorRunning,
    });

    if (editorRunning) {
      ctx.outputChannel.appendLine('[EngineLink] Editor is running — building without -FromMsBuild to avoid hot-reload DLL locks.');
    }

    await runBuildCommand(ctx, cmd.executable, cmd.args, 'Build');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`EngineLink: Build failed unexpectedly — ${message}`, 'Show Output').then((choice) => {
      if (choice === 'Show Output') ctx.outputChannel.show();
    });
    ctx.outputChannel.appendLine(`[EngineLink] Build error: ${message}`);
  }
}

/**
 * Execute a rebuild (clean + build).
 */
export async function executeRebuild(ctx: EngineLinkContext, settings: EngineLinkSettings) {
  if (!ctx.project || !ctx.engine) {
    vscode.window.showErrorMessage('EngineLink: No project or engine detected.');
    return;
  }

  try {
    const editorRunning = await isUnrealEditorRunning();

    // Warn when editor is running — rebuild (clean+build) is disruptive
    if (editorRunning) {
      const choice = await vscode.window.showWarningMessage(
        'EngineLink: Unreal Editor is running. Rebuild will clean all artifacts — this may crash the editor. Use Live Coding instead?',
        'Use Live Coding',
        'Rebuild Anyway',
        'Cancel',
      );

      if (choice === 'Use Live Coding') {
        const { triggerLiveCoding } = await import('./liveCodingCommand');
        await triggerLiveCoding(ctx, settings);
        return;
      }
      if (choice !== 'Rebuild Anyway') return;
    }

    // Clean first
    const cleanCmd = cleanCommandLine(ctx.engine, ctx.project, {
      configuration: settings.buildConfiguration,
      targetType: settings.buildTarget,
      platform: settings.platform,
    });

    const statusBar = getStatusBar();
    statusBar.showBuilding();
    ctx.outputChannel.show(true);
    ctx.outputChannel.appendLine('[EngineLink] Starting clean...');

    const cleanResult = await spawnAsync(cleanCmd.executable, cleanCmd.args, {
      onStdout: (line) => ctx.outputChannel.appendLine(line),
      onStderr: (line) => ctx.outputChannel.appendLine(line),
    });

    if (cleanResult.exitCode !== 0) {
      ctx.outputChannel.appendLine('[EngineLink] Clean step failed.');
      const currentSettings = getSettings();
      statusBar.showBuildResult(false, 1, ctx, currentSettings);
      vscode.window.showErrorMessage('EngineLink: Clean step failed. Check output for details.', 'Show Output').then((choice) => {
        if (choice === 'Show Output') ctx.outputChannel.show();
      });
      return;
    }

    ctx.outputChannel.appendLine('[EngineLink] Clean complete. Starting build...');

    // Then build
    const buildCmd = buildCommandLine(ctx.engine, ctx.project, {
      configuration: settings.buildConfiguration,
      targetType: settings.buildTarget,
      platform: settings.platform,
      editorRunning,
    });

    if (editorRunning) {
      ctx.outputChannel.appendLine('[EngineLink] Editor is running — building without -FromMsBuild to avoid hot-reload DLL locks.');
    }

    await runBuildCommand(ctx, buildCmd.executable, buildCmd.args, 'Rebuild');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`EngineLink: Rebuild failed unexpectedly — ${message}`, 'Show Output').then((choice) => {
      if (choice === 'Show Output') ctx.outputChannel.show();
    });
    ctx.outputChannel.appendLine(`[EngineLink] Rebuild error: ${message}`);
  }
}

/**
 * Execute a clean.
 */
export async function executeClean(ctx: EngineLinkContext, settings: EngineLinkSettings) {
  if (!ctx.project || !ctx.engine) {
    vscode.window.showErrorMessage('EngineLink: No project or engine detected.');
    return;
  }

  try {
    const cmd = cleanCommandLine(ctx.engine, ctx.project, {
      configuration: settings.buildConfiguration,
      targetType: settings.buildTarget,
      platform: settings.platform,
    });

    await runBuildCommand(ctx, cmd.executable, cmd.args, 'Clean');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`EngineLink: Clean failed unexpectedly — ${message}`, 'Show Output').then((choice) => {
      if (choice === 'Show Output') ctx.outputChannel.show();
    });
    ctx.outputChannel.appendLine(`[EngineLink] Clean error: ${message}`);
  }
}

/**
 * Run a build command with output streaming, error parsing, and proper UI feedback.
 */
async function runBuildCommand(
  ctx: EngineLinkContext,
  executable: string,
  args: string[],
  actionName: string,
) {
  const statusBar = getStatusBar();
  const currentSettings = getSettings();

  // Check if already building
  if (statusBar.isBuilding) {
    vscode.window.showWarningMessage('EngineLink: A build is already in progress.');
    return;
  }

  ctx.outputChannel.show(true);
  ctx.outputChannel.appendLine(`[EngineLink] ${actionName}: "${executable}" ${args.join(' ')}`);
  ctx.outputChannel.appendLine('');

  ctx.diagnosticCollection.clear();
  ctx.lastBuildErrors = [];

  const diagnostics: ParsedDiagnostic[] = [];
  const startTime = Date.now();

  // Show spinner in status bar
  statusBar.showBuilding();

  // Also show progress notification so user sees something even if status bar is hidden
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `EngineLink: ${actionName}`,
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Starting...' });

      let lineCount = 0;
      const result = await spawnAsync(executable, args, {
        onStdout: (line) => {
          ctx.outputChannel.appendLine(line);
          const diag = parseBuildLine(line);
          if (diag) diagnostics.push(diag);
          lineCount++;
          // Update progress periodically
          if (lineCount % 50 === 0) {
            progress.report({ message: `Processing... (${lineCount} lines)` });
          }
        },
        onStderr: (line) => {
          ctx.outputChannel.appendLine(line);
          const diag = parseBuildLine(line);
          if (diag) diagnostics.push(diag);
        },
      });

      const duration = Date.now() - startTime;
      const success = result.exitCode === 0;
      const errors = diagnostics.filter((d) => d.severity === 'error').length;
      const warnings = diagnostics.filter((d) => d.severity === 'warning').length;

      ctx.lastBuildErrors = diagnostics;
      ctx.lastBuildResult = { success, duration, errors, warnings };

      // Push diagnostics to VS Code Problems panel
      pushDiagnostics(ctx, diagnostics);

      ctx.outputChannel.appendLine('');
      ctx.outputChannel.appendLine(
        `[EngineLink] ${actionName} ${success ? 'succeeded' : 'failed'} in ${(duration / 1000).toFixed(1)}s (${errors} error(s), ${warnings} warning(s))`,
      );

      // Update status bar with result
      statusBar.showBuildResult(success, errors, ctx, currentSettings);

      if (success) {
        if (warnings > 0) {
          vscode.window.showWarningMessage(
            `EngineLink: ${actionName} succeeded with ${warnings} warning(s) in ${(duration / 1000).toFixed(1)}s`,
            'Show Output', 'Show Warnings',
          ).then((choice) => {
            if (choice === 'Show Output') ctx.outputChannel.show();
            if (choice === 'Show Warnings') vscode.commands.executeCommand('workbench.action.problems.focus');
          });
        } else {
          vscode.window.showInformationMessage(
            `EngineLink: ${actionName} succeeded in ${(duration / 1000).toFixed(1)}s`,
          );
        }
      } else {
        // Show error with actionable buttons
        const firstError = diagnostics.find((d) => d.severity === 'error');
        const errorPreview = firstError
          ? `\n${firstError.message.substring(0, 100)}`
          : '';

        vscode.window.showErrorMessage(
          `EngineLink: ${actionName} failed with ${errors} error(s)${errorPreview}`,
          'Show Problems', 'Show Output',
        ).then((choice) => {
          if (choice === 'Show Problems') vscode.commands.executeCommand('workbench.action.problems.focus');
          if (choice === 'Show Output') ctx.outputChannel.show();
        });
      }
    },
  );
}

/**
 * Convert parsed diagnostics to VS Code diagnostics and push to the collection.
 */
function pushDiagnostics(ctx: EngineLinkContext, diagnostics: ParsedDiagnostic[]) {
  const byFile = new Map<string, vscode.Diagnostic[]>();

  for (const diag of diagnostics) {
    const uri = diag.file;
    if (!byFile.has(uri)) byFile.set(uri, []);

    const severity =
      diag.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : diag.severity === 'warning'
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information;

    const range = new vscode.Range(
      Math.max(0, diag.line - 1),
      Math.max(0, diag.column - 1),
      Math.max(0, diag.line - 1),
      1000,
    );

    const vsDiag = new vscode.Diagnostic(range, diag.message, severity);
    vsDiag.code = diag.code;
    vsDiag.source = 'EngineLink';
    byFile.get(uri)!.push(vsDiag);
  }

  for (const [filePath, fileDiags] of byFile) {
    ctx.diagnosticCollection.set(vscode.Uri.file(filePath), fileDiags);
  }
}
