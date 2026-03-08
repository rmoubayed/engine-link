import * as vscode from 'vscode';
import { EXTENSION_ID } from '../constants';
import type { BuildConfiguration, BuildTargetType, BuildPlatform } from '../types';

/**
 * Typed wrapper around VS Code workspace settings for EngineLink.
 */
export class EngineLinkSettings {
  private get config() {
    return vscode.workspace.getConfiguration(EXTENSION_ID);
  }

  get engineRoot(): string {
    return this.config.get<string>('engineRoot', '');
  }

  get projectFile(): string {
    return this.config.get<string>('projectFile', '');
  }

  get buildConfiguration(): BuildConfiguration {
    return this.config.get<BuildConfiguration>('buildConfiguration', 'Development');
  }

  get buildTarget(): BuildTargetType {
    return this.config.get<BuildTargetType>('buildTarget', 'Editor');
  }

  get platform(): BuildPlatform {
    return this.config.get<BuildPlatform>('platform', 'Win64');
  }

  get autoGenerateCompileCommands(): boolean {
    return this.config.get<boolean>('autoGenerateCompileCommands', true);
  }

  get liveCodingMethod(): 'keystroke' | 'disabled' {
    return this.config.get<'keystroke' | 'disabled'>('liveCoding.method', 'keystroke');
  }

  get vsBuildToolsPath(): string {
    return this.config.get<string>('vsBuildTools.path', '');
  }

  /**
   * Listen for configuration changes.
   */
  onDidChange(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(EXTENSION_ID)) {
        callback();
      }
    });
  }
}
