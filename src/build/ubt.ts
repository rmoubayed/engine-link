import type { UEInstallation, UEProject, BuildConfiguration, BuildTargetType, BuildPlatform } from '../types';
import { TARGET_SUFFIXES } from '../constants';

export interface UBTCommandLine {
  executable: string;
  args: string[];
}

/**
 * Resolve the target name from the project and target type.
 * E.g., "MyProject" + "Editor" → "MyProjectEditor"
 */
export function resolveTargetName(project: UEProject, targetType: BuildTargetType): string {
  const suffix = TARGET_SUFFIXES[targetType] ?? '';
  return project.name + suffix;
}

/**
 * Build the UBT command line for a build action.
 */
export function buildCommandLine(
  engine: UEInstallation,
  project: UEProject,
  options: {
    configuration: BuildConfiguration;
    targetType: BuildTargetType;
    platform: BuildPlatform;
    editorRunning?: boolean;
    additionalArgs?: string[];
  },
): UBTCommandLine {
  const target = resolveTargetName(project, options.targetType);
  const args = [
    target,
    options.platform,
    options.configuration,
    `-project=${project.uprojectPath}`,
    '-WaitMutex',
    // Skip -FromMsBuild when UE Editor is running — it tries to delete hot-reload
    // DLLs that are locked by the running editor, causing OtherCompilationError.
    // Rider also omits this flag when the editor is open.
    ...(options.editorRunning ? [] : ['-FromMsBuild']),
    ...(options.additionalArgs ?? []),
  ];

  return { executable: engine.ubtPath, args };
}

/**
 * Build the UBT command line for a clean action.
 */
export function cleanCommandLine(
  engine: UEInstallation,
  project: UEProject,
  options: {
    configuration: BuildConfiguration;
    targetType: BuildTargetType;
    platform: BuildPlatform;
  },
): UBTCommandLine {
  const target = resolveTargetName(project, options.targetType);
  const args = [
    target,
    options.platform,
    options.configuration,
    `-project=${project.uprojectPath}`,
    '-clean',
  ];

  return { executable: engine.ubtPath, args };
}

/**
 * Build the UBT command line for compile_commands.json generation.
 */
export function generateClangDatabaseCommandLine(
  engine: UEInstallation,
  project: UEProject,
  options: {
    configuration?: BuildConfiguration;
    platform?: BuildPlatform;
  } = {},
): UBTCommandLine {
  const target = resolveTargetName(project, 'Editor');
  const args = [
    target,
    options.platform ?? 'Win64',
    options.configuration ?? 'Development',
    `-project=${project.uprojectPath}`,
    '-mode=GenerateClangDatabase',
  ];

  return { executable: engine.ubtPath, args };
}

/**
 * Format a UBT command line for display.
 */
export function formatCommandLine(cmd: UBTCommandLine): string {
  return `"${cmd.executable}" ${cmd.args.join(' ')}`;
}
