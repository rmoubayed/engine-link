import * as vscode from 'vscode';

/**
 * Create the EngineLink output channel.
 */
export function createOutputChannel(): vscode.OutputChannel {
  return vscode.window.createOutputChannel('EngineLink');
}
