import * as vscode from 'vscode';
import * as path from 'path';
import { parseUProject } from '../parsers/uprojectParser';
import type { UEProject } from '../types';

/**
 * Scan workspace for .uproject files and return detected projects.
 */
export async function detectProjects(): Promise<UEProject[]> {
  const uris = await vscode.workspace.findFiles('**/*.uproject', '**/Intermediate/**', 10);
  const projects: UEProject[] = [];

  for (const uri of uris) {
    try {
      const data = await parseUProject(uri.fsPath);
      projects.push({
        name: path.basename(uri.fsPath, '.uproject'),
        uprojectPath: uri.fsPath,
        projectRoot: path.dirname(uri.fsPath),
        engineAssociation: data.engineAssociation,
        modules: data.modules,
      });
    } catch (err) {
      console.warn(`[EngineLink] Failed to parse ${uri.fsPath}:`, err);
    }
  }

  return projects;
}

/**
 * Prompt the user to select a project if multiple are found.
 */
export async function selectProject(projects: UEProject[]): Promise<UEProject | undefined> {
  if (projects.length === 0) return undefined;
  if (projects.length === 1) return projects[0];

  const items = projects.map((p) => ({
    label: p.name,
    description: p.uprojectPath,
    project: p,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select an Unreal Engine project',
  });

  return picked?.project;
}

/**
 * Watch for .uproject file changes in the workspace.
 */
export function watchForProjectChanges(
  callback: () => void,
): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.uproject');
  const disposables: vscode.Disposable[] = [];
  disposables.push(watcher.onDidCreate(callback));
  disposables.push(watcher.onDidDelete(callback));
  disposables.push(watcher);
  return vscode.Disposable.from(...disposables);
}
