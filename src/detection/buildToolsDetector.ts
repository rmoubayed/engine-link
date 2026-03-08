import * as path from 'path';
import { spawnAsync } from '../platform/process';
import { fileExists } from '../platform/paths';
import type { VSBuildTools } from '../types';

const VSWHERE_PATH =
  'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';

/**
 * Detect Visual Studio Build Tools installation using vswhere.exe.
 */
export async function detectBuildTools(
  manualPath?: string,
): Promise<VSBuildTools | undefined> {
  // Manual override
  if (manualPath) {
    return validateBuildToolsAt(manualPath);
  }

  // Auto-detect via vswhere
  if (!(await fileExists(VSWHERE_PATH))) {
    return undefined;
  }

  try {
    const result = await spawnAsync(VSWHERE_PATH, [
      '-latest',
      '-products',
      '*',
      '-requires',
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-format',
      'json',
      '-utf8',
    ]);

    if (result.exitCode !== 0) return undefined;

    const installations = JSON.parse(result.stdout);
    if (!Array.isArray(installations) || installations.length === 0) return undefined;

    const install = installations[0];
    return {
      installationPath: install.installationPath,
      version: install.installationVersion ?? '',
      displayName: install.displayName ?? 'Visual Studio',
      hasMSVC: true,
      hasWindowsSDK: await checkWindowsSDK(install.installationPath),
    };
  } catch {
    return undefined;
  }
}

/**
 * Validate a build tools installation at a given path.
 */
async function validateBuildToolsAt(installPath: string): Promise<VSBuildTools | undefined> {
  const msvcPath = path.join(installPath, 'VC', 'Tools', 'MSVC');
  const hasMSVC = await fileExists(msvcPath);
  if (!hasMSVC) return undefined;

  return {
    installationPath: installPath,
    version: '',
    displayName: 'Visual Studio Build Tools (manual)',
    hasMSVC: true,
    hasWindowsSDK: await checkWindowsSDK(installPath),
  };
}

/**
 * Check if Windows SDK components are available.
 */
async function checkWindowsSDK(installPath: string): Promise<boolean> {
  // Check via vswhere for Windows SDK component
  try {
    const result = await spawnAsync(VSWHERE_PATH, [
      '-path',
      installPath,
      '-requires',
      'Microsoft.VisualStudio.Component.Windows11SDK.22621',
      '-format',
      'json',
      '-utf8',
    ]);
    const installations = JSON.parse(result.stdout);
    return Array.isArray(installations) && installations.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get a short display name for the build tools (e.g., "VS 2022 (17.9)").
 */
export function getBuildToolsDisplayName(tools: VSBuildTools): string {
  const majorVersion = tools.version.split('.')[0];
  const yearMap: Record<string, string> = {
    '17': '2022',
    '16': '2019',
    '15': '2017',
  };
  const year = yearMap[majorVersion] ?? majorVersion;
  const shortVersion = tools.version.split('.').slice(0, 2).join('.');
  return `VS ${year} (${shortVersion})`;
}
