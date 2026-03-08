import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateClangDatabaseCommandLine, formatCommandLine } from '../build/ubt';
import { spawnAsync } from '../platform/process';
import { fileExists } from '../platform/paths';
import type { EngineLinkContext } from '../types';
import type { EngineLinkSettings } from '../config/settings';

/**
 * Generate compile_commands.json via UBT and place it at the project root.
 */
export async function generateCompileCommands(
  ctx: EngineLinkContext,
  settings: EngineLinkSettings,
) {
  if (!ctx.project || !ctx.engine) {
    vscode.window.showErrorMessage('EngineLink: No project or engine detected.');
    return;
  }

  const cmd = generateClangDatabaseCommandLine(ctx.engine, ctx.project, {
    configuration: settings.buildConfiguration,
    platform: settings.platform,
  });

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'EngineLink: Generating compile_commands.json...',
      cancellable: true,
    },
    async (progress, token) => {
      ctx.outputChannel.show(true);
      ctx.outputChannel.appendLine(`[EngineLink] ${formatCommandLine(cmd)}`);

      const result = await spawnAsync(cmd.executable, cmd.args, {
        onStdout: (line) => ctx.outputChannel.appendLine(line),
        onStderr: (line) => ctx.outputChannel.appendLine(line),
        token,
      });

      if (result.exitCode !== 0) {
        vscode.window
          .showErrorMessage('EngineLink: Failed to generate compile_commands.json.', 'Show Output')
          .then((choice) => {
            if (choice === 'Show Output') ctx.outputChannel.show();
          });
        return;
      }

      // Find and copy compile_commands.json to project root
      const placed = await findAndPlaceCompileCommands(ctx);

      if (placed) {
        vscode.window.showInformationMessage(
          'EngineLink: compile_commands.json generated successfully.',
        );
      } else {
        vscode.window.showWarningMessage(
          'EngineLink: compile_commands.json generated but could not be located. Check UBT output.',
        );
      }
    },
  );
}

/**
 * Search for the generated compile_commands.json and copy/symlink to project root.
 */
async function findAndPlaceCompileCommands(ctx: EngineLinkContext): Promise<boolean> {
  if (!ctx.project || !ctx.engine) return false;

  const projectRoot = ctx.project.projectRoot;
  const targetPath = path.join(projectRoot, 'compile_commands.json');

  // Check if UBT placed it at the project root already
  if (await fileExists(targetPath)) {
    ctx.outputChannel.appendLine(`[EngineLink] compile_commands.json found at project root.`);
    return true;
  }

  // Search common output locations
  const searchPaths = [
    path.join(projectRoot, 'Intermediate', 'Build'),
    path.join(ctx.engine.root, 'Intermediate', 'Build'),
  ];

  for (const searchBase of searchPaths) {
    const found = await findFileRecursive(searchBase, 'compile_commands.json', 4);
    if (found) {
      ctx.outputChannel.appendLine(`[EngineLink] Found at: ${found}`);
      ctx.outputChannel.appendLine(`[EngineLink] Copying to: ${targetPath}`);
      await fs.promises.copyFile(found, targetPath);
      return true;
    }
  }

  return false;
}

/**
 * Recursively search for a file up to a given depth.
 */
async function findFileRecursive(
  dir: string,
  filename: string,
  maxDepth: number,
): Promise<string | undefined> {
  if (maxDepth <= 0) return undefined;

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === filename) {
        return fullPath;
      }
      if (entry.isDirectory()) {
        const found = await findFileRecursive(fullPath, filename, maxDepth - 1);
        if (found) return found;
      }
    }
  } catch {
    // Directory not readable
  }

  return undefined;
}
