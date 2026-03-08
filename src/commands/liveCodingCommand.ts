import * as vscode from 'vscode';
import { spawnAsync, isUnrealEditorRunning } from '../platform/process';
import type { EngineLinkContext } from '../types';
import type { EngineLinkSettings } from '../config/settings';

/** Re-entry guard — prevents infinite loop when Ctrl+Alt+F11 bounces back to Cursor. */
let liveCodingInProgress = false;

/**
 * Trigger a Live Coding compile by sending Ctrl+Alt+F11 to the Unreal Editor window.
 *
 * Uses PowerShell to:
 *   1. Find the UnrealEditor process
 *   2. Bring its window to the foreground
 *   3. Send Ctrl+Alt+F11 to it (not to Cursor)
 *
 * A re-entry guard prevents the infinite loop that would occur if SendKeys
 * targeted Cursor instead (Cursor's Ctrl+Alt+F11 keybinding would re-trigger this).
 */
export async function triggerLiveCoding(ctx: EngineLinkContext, settings: EngineLinkSettings) {
  if (settings.liveCodingMethod === 'disabled') {
    vscode.window.showWarningMessage('EngineLink: Live Coding is disabled in settings.');
    return;
  }

  // Prevent re-entry (guards against keystroke bouncing back to Cursor)
  if (liveCodingInProgress) return;

  // Check if Unreal Editor is running
  const isRunning = await isUnrealEditorRunning();
  if (!isRunning) {
    vscode.window.showWarningMessage(
      'EngineLink: Unreal Editor must be running for Live Coding.',
    );
    return;
  }

  liveCodingInProgress = true;
  ctx.outputChannel.appendLine('[EngineLink] Triggering Live Coding compile (Ctrl+Alt+F11)...');

  try {
    // PowerShell script that:
    // 1. Finds the UnrealEditor process window handle
    // 2. Brings it to the foreground via SetForegroundWindow
    // 3. Sends Ctrl+Alt+F11 to it
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class UEWindow {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
  }
"@
$ue = Get-Process -Name "UnrealEditor" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($ue -and $ue.MainWindowHandle -ne [IntPtr]::Zero) {
  [UEWindow]::SetForegroundWindow($ue.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 200
  [System.Windows.Forms.SendKeys]::SendWait('^%{F11}')
  Write-Output "OK"
} else {
  Write-Error "UnrealEditor window not found"
  exit 1
}
`.trim();

    const result = await spawnAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      psScript,
    ]);

    if (result.exitCode === 0) {
      vscode.window.showInformationMessage('EngineLink: Live Coding compile triggered.');
    } else {
      ctx.outputChannel.appendLine(`[EngineLink] Live Coding trigger failed: ${result.stderr}`);
      vscode.window.showErrorMessage('EngineLink: Failed to trigger Live Coding.');
    }
  } catch (err) {
    ctx.outputChannel.appendLine(`[EngineLink] Live Coding error: ${err}`);
    vscode.window.showErrorMessage('EngineLink: Failed to trigger Live Coding.');
  } finally {
    // Release guard after a short delay to absorb any bounced keystrokes
    setTimeout(() => { liveCodingInProgress = false; }, 2000);
  }
}

