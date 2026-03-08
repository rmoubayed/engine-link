import * as vscode from 'vscode';
import { Commands } from '../constants';
import type { EngineLinkContext } from '../types';
import type { EngineLinkSettings } from '../config/settings';

/**
 * EngineLink status bar — Rider-style toolbar at the bottom.
 *
 * Layout (left to right):
 *   [▶ BUILD] | [⟳ Rebuild] | [🗑 Clean] | [Development ▾] | [Editor ▾] | [Win64] | [ProjectName] | [UE 5.4] | [⚡ LIVE CODING] | [🚀 LAUNCH]
 *
 * - Action buttons have colored backgrounds for visibility
 * - Build button shows spinner + red error state
 * - Config selectors are clickable dropdowns
 */
export class StatusBarManager {
  // Action buttons
  private buildBtn: vscode.StatusBarItem;
  private rebuildBtn: vscode.StatusBarItem;
  private cleanBtn: vscode.StatusBarItem;
  private liveCodingBtn: vscode.StatusBarItem;
  private launchBtn: vscode.StatusBarItem;

  // Config/info items
  private configBtn: vscode.StatusBarItem;
  private targetBtn: vscode.StatusBarItem;
  private platformBtn: vscode.StatusBarItem;
  private projectBtn: vscode.StatusBarItem;
  private engineBtn: vscode.StatusBarItem;

  private _isBuilding = false;

  constructor() {
    // Higher priority = further left. Actions on left, config in middle, launch/live on right.

    // --- Left group: Build actions ---
    this.buildBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 300);
    this.buildBtn.command = Commands.Build;
    this.buildBtn.name = 'EngineLink: Build';

    this.rebuildBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 299);
    this.rebuildBtn.command = Commands.Rebuild;
    this.rebuildBtn.name = 'EngineLink: Rebuild';

    this.cleanBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 298);
    this.cleanBtn.command = Commands.Clean;
    this.cleanBtn.name = 'EngineLink: Clean';

    // --- Middle group: Config selectors ---
    this.configBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 297);
    this.configBtn.command = Commands.SelectBuildConfig;
    this.configBtn.name = 'EngineLink: Configuration';

    this.targetBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 296);
    this.targetBtn.command = Commands.SelectTarget;
    this.targetBtn.name = 'EngineLink: Target';

    this.platformBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 295);
    this.platformBtn.name = 'EngineLink: Platform';

    this.projectBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 294);
    this.projectBtn.command = Commands.SelectProject;
    this.projectBtn.name = 'EngineLink: Project';

    this.engineBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 293);
    this.engineBtn.command = Commands.SelectEngine;
    this.engineBtn.name = 'EngineLink: Engine';

    // --- Right group: Live Coding + Launch ---
    this.liveCodingBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 292);
    this.liveCodingBtn.command = Commands.LiveCoding;
    this.liveCodingBtn.name = 'EngineLink: Live Coding';

    this.launchBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 291);
    this.launchBtn.command = Commands.LaunchEditor;
    this.launchBtn.name = 'EngineLink: Launch';
  }

  get isBuilding(): boolean {
    return this._isBuilding;
  }

  /**
   * Update all status bar items based on current context and settings.
   */
  update(ctx: EngineLinkContext, settings: EngineLinkSettings): void {
    if (this._isBuilding) return;

    // ── BUILD button (prominent, colored) ──
    this.buildBtn.text = '$(play)  BUILD';
    this.buildBtn.tooltip = 'Build project (Ctrl+Shift+B)';
    this.buildBtn.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    this.buildBtn.color = undefined;
    this.buildBtn.command = Commands.Build;

    // ── REBUILD button ──
    this.rebuildBtn.text = '$(refresh)  Rebuild';
    this.rebuildBtn.tooltip = 'Clean + Build';

    // ── CLEAN button ──
    this.cleanBtn.text = '$(trash)  Clean';
    this.cleanBtn.tooltip = 'Clean build artifacts';

    // ── Configuration ──
    this.configBtn.text = `$(gear)  ${settings.buildConfiguration}`;
    this.configBtn.tooltip = 'Build configuration — click to change';

    // ── Target ──
    this.targetBtn.text = `$(symbol-class)  ${settings.buildTarget}`;
    this.targetBtn.tooltip = 'Build target — click to change';

    // ── Platform ──
    this.platformBtn.text = `$(device-desktop)  ${settings.platform}`;
    this.platformBtn.tooltip = `Target platform: ${settings.platform}`;

    // ── Project ──
    if (ctx.project) {
      this.projectBtn.text = `$(file-code)  ${ctx.project.name}`;
      this.projectBtn.tooltip = ctx.project.uprojectPath;
      this.projectBtn.backgroundColor = undefined;
    } else {
      this.projectBtn.text = '$(warning)  No Project';
      this.projectBtn.tooltip = 'No .uproject found — click to select';
      this.projectBtn.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }

    // ── Engine ──
    if (ctx.engine) {
      this.engineBtn.text = `$(package)  UE ${ctx.engine.version}`;
      this.engineBtn.tooltip = ctx.engine.root;
      this.engineBtn.backgroundColor = undefined;
    } else {
      this.engineBtn.text = '$(warning)  No Engine';
      this.engineBtn.tooltip = 'No engine found — click to select';
      this.engineBtn.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }

    // ── LIVE CODING (colored) ──
    this.liveCodingBtn.text = '$(zap)  LIVE CODING';
    this.liveCodingBtn.tooltip = 'Trigger Live Coding compile (Ctrl+Alt+F11)';
    this.liveCodingBtn.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');

    // ── LAUNCH (colored) ──
    this.launchBtn.text = '$(rocket)  LAUNCH';
    this.launchBtn.tooltip = 'Launch Unreal Editor';
    this.launchBtn.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');

    // Show/hide
    if (ctx.project) {
      this.buildBtn.show();
      this.rebuildBtn.show();
      this.cleanBtn.show();
      this.configBtn.show();
      this.targetBtn.show();
      this.platformBtn.show();
      this.projectBtn.show();
      this.engineBtn.show();
      this.liveCodingBtn.show();
      this.launchBtn.show();
    } else {
      this.buildBtn.hide();
      this.rebuildBtn.hide();
      this.cleanBtn.hide();
      this.configBtn.hide();
      this.targetBtn.hide();
      this.platformBtn.hide();
      this.projectBtn.show();
      this.engineBtn.hide();
      this.liveCodingBtn.hide();
      this.launchBtn.hide();
    }
  }

  /**
   * Show building spinner.
   */
  showBuilding(): void {
    this._isBuilding = true;
    this.buildBtn.text = '$(sync~spin)  BUILDING...';
    this.buildBtn.tooltip = 'Build in progress...';
    this.buildBtn.backgroundColor = undefined;
    this.buildBtn.command = undefined;
  }

  /**
   * Show build result, then revert after delay.
   */
  showBuildResult(success: boolean, errorCount: number, ctx: EngineLinkContext, settings: EngineLinkSettings): void {
    this._isBuilding = false;

    if (success) {
      this.buildBtn.text = '$(check)  BUILD OK';
      this.buildBtn.tooltip = 'Build succeeded — click to build again';
      this.buildBtn.backgroundColor = undefined;
      this.buildBtn.command = Commands.Build;
    } else {
      this.buildBtn.text = `$(error)  ${errorCount} ERROR${errorCount !== 1 ? 'S' : ''}`;
      this.buildBtn.tooltip = 'Build failed — click to view errors';
      this.buildBtn.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.buildBtn.command = 'workbench.action.problems.focus';
    }

    setTimeout(() => {
      this._isBuilding = false;
      this.update(ctx, settings);
    }, 5000);
  }

  dispose(): void {
    this.buildBtn.dispose();
    this.rebuildBtn.dispose();
    this.cleanBtn.dispose();
    this.configBtn.dispose();
    this.targetBtn.dispose();
    this.platformBtn.dispose();
    this.projectBtn.dispose();
    this.engineBtn.dispose();
    this.liveCodingBtn.dispose();
    this.launchBtn.dispose();
  }
}
