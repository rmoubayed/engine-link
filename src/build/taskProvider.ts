import * as vscode from 'vscode';
import { buildCommandLine, cleanCommandLine, generateClangDatabaseCommandLine, formatCommandLine } from './ubt';
import { EXTENSION_ID } from '../constants';
import type { EngineLinkContext, EngineLinkTaskDefinition, BuildConfiguration, BuildTargetType, BuildPlatform } from '../types';
import { EngineLinkSettings } from '../config/settings';

/**
 * Task provider for EngineLink build tasks.
 */
export class EngineLinkTaskProvider implements vscode.TaskProvider<vscode.Task> {
  static readonly type = EXTENSION_ID;

  constructor(
    private ctx: EngineLinkContext,
    private settings: EngineLinkSettings,
  ) {}

  provideTasks(): vscode.ProviderResult<vscode.Task[]> {
    if (!this.ctx.project || !this.ctx.engine) return [];

    const config = this.settings.buildConfiguration;
    const target = this.settings.buildTarget;
    const platform = this.settings.platform;

    return [
      this.createTask('build', `Build (${config} ${target})`, config, target, platform),
      this.createTask('clean', 'Clean', config, target, platform),
      this.createTask('generateCompileCommands', 'Generate compile_commands.json', config, target, platform),
    ];
  }

  resolveTask(task: vscode.Task): vscode.ProviderResult<vscode.Task> {
    const definition = task.definition as EngineLinkTaskDefinition;
    if (!this.ctx.project || !this.ctx.engine) return undefined;

    const config = definition.configuration ?? this.settings.buildConfiguration;
    const target = definition.targetType ?? this.settings.buildTarget;
    const platform = definition.platform ?? this.settings.platform;

    return this.createTask(definition.action, task.name, config, target, platform);
  }

  private createTask(
    action: string,
    label: string,
    config: BuildConfiguration,
    target: BuildTargetType,
    platform: BuildPlatform,
  ): vscode.Task {
    const definition: EngineLinkTaskDefinition = {
      type: EXTENSION_ID,
      action: action as EngineLinkTaskDefinition['action'],
      configuration: config,
      targetType: target,
      platform,
    };

    let cmd;
    switch (action) {
      case 'clean':
        cmd = cleanCommandLine(this.ctx.engine!, this.ctx.project!, {
          configuration: config,
          targetType: target,
          platform,
        });
        break;
      case 'generateCompileCommands':
        cmd = generateClangDatabaseCommandLine(this.ctx.engine!, this.ctx.project!, {
          configuration: config,
          platform,
        });
        break;
      default:
        cmd = buildCommandLine(this.ctx.engine!, this.ctx.project!, {
          configuration: config,
          targetType: target,
          platform,
        });
    }

    const execution = new vscode.ShellExecution(
      `"${cmd.executable}"`,
      cmd.args,
    );

    const task = new vscode.Task(
      definition,
      vscode.TaskScope.Workspace,
      `EngineLink: ${label}`,
      EXTENSION_ID,
      execution,
      ['$enginelink-msvc', '$enginelink-ubt'],
    );

    task.group = vscode.TaskGroup.Build;
    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Shared,
      clear: true,
    };

    return task;
  }
}
