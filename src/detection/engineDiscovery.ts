import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { readRegistryValue, enumerateRegistrySubKeys, readRegistryKeyValues } from '../platform/registry';
import { fileExists, resolveUBTPath, resolveEditorPath } from '../platform/paths';
import { Registry, COMMON_ENGINE_PATHS } from '../constants';
import type { UEInstallation, UEProject } from '../types';

/**
 * Discover all Unreal Engine installations on the system.
 */
export async function discoverEngines(): Promise<UEInstallation[]> {
  const installations: UEInstallation[] = [];
  const seen = new Set<string>();

  // 1. Scan launcher installs from registry (HKLM)
  const launcherInstalls = await scanLauncherInstalls();
  for (const install of launcherInstalls) {
    const key = install.root.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      installations.push(install);
    }
  }

  // 2. Scan source builds from registry (HKCU)
  const sourceBuilds = await scanSourceBuilds();
  for (const install of sourceBuilds) {
    const key = install.root.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      installations.push(install);
    }
  }

  // 3. Scan common file system paths
  const pathScans = await scanCommonPaths();
  for (const install of pathScans) {
    const key = install.root.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      installations.push(install);
    }
  }

  return installations;
}

/**
 * Scan HKLM registry for Epic Games Launcher-installed engines.
 */
async function scanLauncherInstalls(): Promise<UEInstallation[]> {
  const installations: UEInstallation[] = [];

  const versions = await enumerateRegistrySubKeys(Registry.LauncherInstalls);
  for (const version of versions) {
    const installDir = await readRegistryValue(
      `${Registry.LauncherInstalls}\\${version}`,
      'InstalledDirectory',
    );
    if (installDir) {
      const install = await buildInstallation(installDir, version, 'registry', false);
      if (install) installations.push(install);
    }
  }

  return installations;
}

/**
 * Scan HKCU registry for source-built engines (GUID-based).
 */
async function scanSourceBuilds(): Promise<UEInstallation[]> {
  const installations: UEInstallation[] = [];

  const builds = await readRegistryKeyValues(Registry.SourceBuilds);
  for (const [guid, engineRoot] of builds) {
    const install = await buildInstallation(engineRoot, guid, 'registry', true);
    if (install) installations.push(install);
  }

  return installations;
}

/**
 * Scan common file system paths for UE installations.
 */
async function scanCommonPaths(): Promise<UEInstallation[]> {
  const installations: UEInstallation[] = [];

  for (const basePath of COMMON_ENGINE_PATHS) {
    try {
      const entries = await fs.promises.readdir(basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('UE_')) {
          const engineRoot = path.join(basePath, entry.name);
          const version = entry.name.replace('UE_', '');
          const install = await buildInstallation(engineRoot, version, 'path-scan', false);
          if (install) installations.push(install);
        }
      }
    } catch {
      // Directory doesn't exist or isn't readable
    }
  }

  return installations;
}

/**
 * Build a UEInstallation from a root path, validating that key files exist.
 */
async function buildInstallation(
  root: string,
  version: string,
  source: UEInstallation['source'],
  isSourceBuild: boolean,
): Promise<UEInstallation | undefined> {
  const ubtPath = resolveUBTPath(root);
  const editorPath = resolveEditorPath(root);

  if (!(await fileExists(ubtPath))) return undefined;

  return {
    version,
    root,
    source,
    ubtPath,
    editorPath,
    isSourceBuild,
  };
}

/**
 * Find the engine installation matching a project's EngineAssociation.
 */
export async function findMatchingEngine(
  project: UEProject,
  installations: UEInstallation[],
): Promise<UEInstallation | undefined> {
  const assoc = project.engineAssociation;

  if (!assoc) return undefined;

  // GUID association → source build
  if (assoc.startsWith('{') && assoc.endsWith('}')) {
    return installations.find((i) => i.isSourceBuild && i.version === assoc);
  }

  // Version string → launcher install
  return installations.find((i) => !i.isSourceBuild && i.version === assoc);
}

/**
 * Prompt the user to select an engine if no match is found.
 */
export async function promptSelectEngine(
  installations: UEInstallation[],
): Promise<UEInstallation | undefined> {
  if (installations.length === 0) {
    vscode.window.showErrorMessage(
      'EngineLink: No Unreal Engine installations found. Set enginelink.engineRoot in settings.',
    );
    return undefined;
  }

  const items = installations.map((i) => ({
    label: `UE ${i.version}`,
    description: i.root,
    detail: i.isSourceBuild ? 'Source build' : 'Launcher install',
    installation: i,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select an Unreal Engine installation',
  });

  return picked?.installation;
}

/**
 * Create a manual installation from user-provided path.
 */
export async function createManualInstallation(
  engineRoot: string,
): Promise<UEInstallation | undefined> {
  return buildInstallation(engineRoot, 'manual', 'manual', false);
}
