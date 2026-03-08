import * as path from 'path';
import * as fs from 'fs';

/**
 * Check if a file exists at the given path.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists at the given path.
 */
export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve the UBT executable path from an engine root.
 */
export function resolveUBTPath(engineRoot: string): string {
  return path.join(
    engineRoot,
    'Engine',
    'Binaries',
    'DotNET',
    'UnrealBuildTool',
    'UnrealBuildTool.exe',
  );
}

/**
 * Resolve the Unreal Editor executable path from an engine root.
 */
export function resolveEditorPath(engineRoot: string): string {
  return path.join(engineRoot, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe');
}

/**
 * Extract the project name from a .uproject file path.
 */
export function projectNameFromPath(uprojectPath: string): string {
  return path.basename(uprojectPath, '.uproject');
}

/**
 * Normalize a Windows path (backslashes → forward slashes not needed, just normalize).
 */
export function normalizePath(p: string): string {
  return path.normalize(p);
}
