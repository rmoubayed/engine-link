/**
 * Detect which AI assistant (editor + extension) is active.
 *
 * Auto-detection order:
 * 1. Check vscode.env.appName for "Cursor"
 * 2. Check for the Claude Code VS Code extension
 * 3. Fall back to 'none'
 */

import * as vscode from 'vscode';

export type AIAssistant = 'cursor' | 'claude' | 'none';

/**
 * Detect the active AI assistant based on editor brand and installed extensions.
 */
export function detectAIAssistant(): AIAssistant {
  // Cursor identifies itself via the app name
  if (vscode.env.appName.toLowerCase().includes('cursor')) {
    return 'cursor';
  }

  // Claude Code is a VS Code extension
  if (vscode.extensions.getExtension('anthropic.claude-code')) {
    return 'claude';
  }

  return 'none';
}

/**
 * Resolve the effective AI assistant from a user setting override.
 * "auto" → runs auto-detection; "cursor" | "claude" → forced override.
 */
export function resolveAIAssistant(setting: 'auto' | 'cursor' | 'claude'): AIAssistant {
  if (setting !== 'auto') {
    return setting;
  }
  return detectAIAssistant();
}
