import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { isUnrealEditorRunning } from '../platform/process';
import { fileExists } from '../platform/paths';
import type { EngineLinkContext } from '../types';

/**
 * Launch Unreal Editor for the active project.
 * Detects if UE is already running and lets the user decide.
 */
export async function launchEditor(ctx: EngineLinkContext) {
  if (!ctx.project || !ctx.engine) {
    vscode.window.showErrorMessage('EngineLink: No project or engine detected.');
    return;
  }

  const editorPath = ctx.engine.editorPath;

  if (!(await fileExists(editorPath))) {
    vscode.window.showErrorMessage(`EngineLink: Editor not found at ${editorPath}`);
    return;
  }

  // Check if Unreal Editor is already running
  const alreadyRunning = await isUnrealEditorRunning();
  if (alreadyRunning) {
    const choice = await vscode.window.showWarningMessage(
      'EngineLink: Unreal Editor is already running.',
      'Launch Another Instance',
      'Cancel',
    );
    if (choice !== 'Launch Another Instance') {
      return;
    }
  }

  ctx.outputChannel.appendLine(`[EngineLink] Launching: "${editorPath}" "${ctx.project.uprojectPath}"`);

  try {
    const proc = spawn(editorPath, [ctx.project.uprojectPath], {
      detached: true,
      stdio: 'ignore',
    });

    proc.unref();

    vscode.window.showInformationMessage(`EngineLink: Launching Unreal Editor for ${ctx.project.name}...`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`EngineLink: Failed to launch editor — ${message}`);
    ctx.outputChannel.appendLine(`[EngineLink] Launch error: ${message}`);
  }
}

