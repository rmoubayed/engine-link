import * as vscode from 'vscode';
import { Commands, EXTENSION_ID } from '../constants';
import type { EngineLinkContext } from '../types';
import type { EngineLinkSettings } from '../config/settings';

/**
 * Minimal icon-only sidebar toolbar for EngineLink.
 * Designed to be dragged to the right side as a thin vertical icon strip.
 *
 * Icons (top to bottom):
 *   ▶ Build  |  ↻ Rebuild  |  🗑 Clean  |  🚀 Launch  |  ⚡ Live Coding  |  📄 CompileDB
 *
 * Build icon changes during build (spinner) and after failure (red error icon).
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = `${EXTENSION_ID}.sidebar`;

  private view?: vscode.WebviewView;

  constructor(
    private _extensionUri: vscode.Uri,
    private ctx: EngineLinkContext,
    private settings: EngineLinkSettings,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'build':
          vscode.commands.executeCommand(Commands.Build);
          break;
        case 'rebuild':
          vscode.commands.executeCommand(Commands.Rebuild);
          break;
        case 'clean':
          vscode.commands.executeCommand(Commands.Clean);
          break;
        case 'launch':
          vscode.commands.executeCommand(Commands.LaunchEditor);
          break;
        case 'liveCoding':
          vscode.commands.executeCommand(Commands.LiveCoding);
          break;
        case 'compileDb':
          vscode.commands.executeCommand(Commands.GenerateCompileCommands);
          break;
      }
    });

    this.pushState();
  }

  /**
   * Push current build state to the webview.
   */
  pushState(): void {
    if (!this.view) return;

    this.view.webview.postMessage({
      type: 'state',
      building: false,
      lastBuild: this.ctx.lastBuildResult ?? null,
      hasProject: !!this.ctx.project,
    });
  }

  /**
   * Toggle build-in-progress spinner.
   */
  pushBuildProgress(building: boolean): void {
    if (!this.view) return;

    this.view.webview.postMessage({
      type: 'buildProgress',
      building,
    });
  }

  private getHtml(_webview: vscode.Webview): string {
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>EngineLink</title>
  <style>
    body {
      margin: 0;
      padding: 4px 0;
      background: var(--vscode-sideBar-background);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-width: 28px;
    }

    .icon-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
      font-size: 16px;
      opacity: 0.8;
      transition: background 0.1s, opacity 0.1s;
      position: relative;
    }

    .icon-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.1));
      opacity: 1;
    }

    .icon-btn:active {
      background: var(--vscode-toolbar-activeBackground, rgba(255,255,255,0.15));
    }

    .icon-btn.primary {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      opacity: 1;
    }

    .icon-btn.primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .icon-btn.error {
      color: var(--vscode-errorForeground, #f44336);
      opacity: 1;
    }

    .icon-btn.disabled {
      opacity: 0.3;
      cursor: default;
      pointer-events: none;
    }

    .separator {
      width: 20px;
      height: 1px;
      background: var(--vscode-widget-border, rgba(255,255,255,0.1));
      margin: 4px 0;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    .spinning {
      animation: spin 1s linear infinite;
      display: inline-block;
    }
  </style>
</head>
<body>
  <button class="icon-btn primary" id="btn-build" title="Build" onclick="send('build')">&#9654;</button>
  <button class="icon-btn" id="btn-rebuild" title="Rebuild" onclick="send('rebuild')">&#8635;</button>
  <button class="icon-btn" id="btn-clean" title="Clean" onclick="send('clean')">&#128465;</button>

  <div class="separator"></div>

  <button class="icon-btn" id="btn-launch" title="Launch Editor" onclick="send('launch')">&#128640;</button>
  <button class="icon-btn" id="btn-livecoding" title="Live Coding" onclick="send('liveCoding')">&#9889;</button>

  <div class="separator"></div>

  <button class="icon-btn" id="btn-compiledb" title="Generate compile_commands.json" onclick="send('compileDb')">&#128196;</button>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function send(type) {
      vscode.postMessage({ type });
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;

      if (msg.type === 'buildProgress') {
        const btn = document.getElementById('btn-build');
        if (msg.building) {
          btn.innerHTML = '<span class="spinning">&#8635;</span>';
          btn.title = 'Building...';
          btn.classList.remove('primary', 'error');
          btn.classList.add('disabled');
        } else {
          btn.innerHTML = '&#9654;';
          btn.title = 'Build';
          btn.classList.remove('disabled');
          btn.classList.add('primary');
        }
      }

      if (msg.type === 'state') {
        const btn = document.getElementById('btn-build');

        if (msg.building) {
          btn.innerHTML = '<span class="spinning">&#8635;</span>';
          btn.title = 'Building...';
          btn.classList.remove('primary', 'error');
          btn.classList.add('disabled');
        } else if (msg.lastBuild && !msg.lastBuild.success) {
          btn.innerHTML = '&#10060;';
          btn.title = msg.lastBuild.errors + ' error(s) - click to rebuild';
          btn.classList.remove('primary', 'disabled');
          btn.classList.add('error');
        } else {
          btn.innerHTML = '&#9654;';
          btn.title = 'Build';
          btn.classList.remove('error', 'disabled');
          btn.classList.add('primary');
        }

        // Disable all buttons if no project
        const btns = document.querySelectorAll('.icon-btn');
        btns.forEach(b => {
          if (!msg.hasProject) b.classList.add('disabled');
          else if (b.id !== 'btn-build') b.classList.remove('disabled');
        });
      }
    });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
