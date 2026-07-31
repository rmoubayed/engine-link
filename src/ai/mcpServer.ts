/**
 * EngineLink MCP bridge — extension side.
 *
 * Starts a local HTTP server that the standalone MCP server process
 * (spawned by Claude Code / Cursor) communicates with. This replaces
 * the previous stdin/stderr IPC which only worked when the extension
 * was the parent process of the MCP server.
 *
 * Architecture:
 *   AI Editor  ←→  MCP Server (mcp-server.js)  ←→  HTTP (localhost)  ←→  Extension
 *   (MCP)           (thin proxy)                    (REST API)            (actual logic)
 */

import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Commands } from '../constants';
import type { EngineLinkContext } from '../types';
import type { EngineLinkSettings } from '../config/settings';
import type { AIAssistant } from './editorDetect';
import { registerMcpServer } from './mcpRegistration';

let httpServer: http.Server | null = null;
let httpPort: number | null = null;

/**
 * Start the HTTP bridge server and register the MCP config for the AI assistant.
 */
export async function startMcpServer(
  extensionPath: string,
  ctx: EngineLinkContext,
  settings: EngineLinkSettings,
  assistant: AIAssistant,
): Promise<void> {
  const serverPath = path.join(extensionPath, 'dist', 'mcp-server.js');

  // Verify mcp-server.js bundle exists
  try {
    await fs.promises.access(serverPath);
  } catch {
    ctx.outputChannel.appendLine('[EngineLink] MCP server bundle not found. Skipping MCP setup.');
    return;
  }

  // Start local HTTP server (random port)
  httpPort = await startHttpBridge(ctx, settings);
  ctx.outputChannel.appendLine(`[EngineLink] HTTP bridge listening on port ${httpPort}`);

  // Write port file so mcp-server.js can discover us
  if (ctx.project) {
    await writePortFile(ctx.project.projectRoot, httpPort);

    // Register MCP config for the AI assistant
    await registerMcpServer(ctx.project.projectRoot, serverPath, assistant);
    ctx.outputChannel.appendLine(
      `[EngineLink] MCP server registered for ${assistant === 'cursor' ? 'Cursor (.cursor/mcp.json)' : assistant === 'claude' ? 'Claude Code (.mcp.json)' : 'manual setup'}.`,
    );
  }

  ctx.outputChannel.appendLine('[EngineLink] MCP bridge ready.');
}

/**
 * Stop the HTTP bridge server.
 */
export function stopMcpServer(): void {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
    httpPort = null;
  }
}

/**
 * Send state update — now a no-op since the MCP server fetches state on demand via HTTP.
 * Kept for API compatibility.
 */
export function sendStateToMcp(_ctx: EngineLinkContext, _settings: EngineLinkSettings): void {
  // State is now fetched on-demand via HTTP GET /state
}

// --- HTTP bridge server ---

function startHttpBridge(ctx: EngineLinkContext, settings: EngineLinkSettings): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // CORS for localhost
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      handleRequest(req, res, ctx, settings).catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      });
    });

    server.on('error', (err) => {
      ctx.outputChannel.appendLine(`[EngineLink] HTTP bridge error: ${err.message}`);
    });

    // Listen on random port
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        httpServer = server;
        resolve(addr.port);
      } else {
        server.close();
        reject(new Error('Failed to get server address'));
      }
    });
  });
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: EngineLinkContext,
  settings: EngineLinkSettings,
) {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  try {
    if (method === 'GET' && url === '/state') {
      // Return current project/engine/build state
      const state = buildStateResponse(ctx, settings);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state));
      return;
    }

    if (method === 'GET' && url === '/build-errors') {
      if (ctx.lastBuildErrors.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify('No build errors. The last build succeeded or no build has been run yet.'));
        return;
      }
      const errorText = ctx.lastBuildErrors
        .map((e) => `${e.file}(${e.line},${e.column}): ${e.severity} ${e.code}: ${e.message}`)
        .join('\n');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(errorText));
      return;
    }

    if (method === 'POST') {
      const body = await readRequestBody(req);

      switch (url) {
        case '/build':
        case '/rebuild':
        case '/clean': {
          const action = url.slice(1); // 'build', 'rebuild', 'clean'
          const command =
            action === 'build'
              ? Commands.Build
              : action === 'rebuild'
                ? Commands.Rebuild
                : Commands.Clean;

          await vscode.commands.executeCommand(command);

          const result = {
            success: ctx.lastBuildResult?.success ?? false,
            errors: ctx.lastBuildResult?.errors ?? 0,
            warnings: ctx.lastBuildResult?.warnings ?? 0,
            duration: ctx.lastBuildResult?.duration ?? 0,
            errorMessages: ctx.lastBuildErrors
              .filter((e) => e.severity === 'error')
              .map((e) => `${e.file}(${e.line}): ${e.code}: ${e.message}`),
            message: ctx.lastBuildResult?.success
              ? `Build succeeded in ${((ctx.lastBuildResult.duration) / 1000).toFixed(1)}s (${ctx.lastBuildResult.warnings} warnings)`
              : `Build failed in ${((ctx.lastBuildResult?.duration ?? 0) / 1000).toFixed(1)}s with ${ctx.lastBuildResult?.errors ?? 0} error(s)`,
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        case '/launch-editor': {
          await vscode.commands.executeCommand(Commands.LaunchEditor);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Unreal Editor launch requested.' }));
          return;
        }

        case '/live-coding': {
          await vscode.commands.executeCommand(Commands.LiveCoding);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Live Coding compile triggered.' }));
          return;
        }

        case '/generate-compile-commands': {
          await vscode.commands.executeCommand(Commands.GenerateCompileCommands);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'compile_commands.json generation started.' }));
          return;
        }
      }
    }

    // Unknown endpoint
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Unknown endpoint: ${method} ${url}` }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.outputChannel.appendLine(`[EngineLink] HTTP bridge error handling ${method} ${url}: ${message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
}

function buildStateResponse(ctx: EngineLinkContext, settings: EngineLinkSettings) {
  if (!ctx.project) {
    return {
      project: null,
      error: 'No Unreal Engine project is currently detected. Open a folder containing a .uproject file.',
    };
  }

  return {
    project: {
      name: ctx.project.name,
      uprojectPath: ctx.project.uprojectPath,
      projectRoot: ctx.project.projectRoot,
      engineAssociation: ctx.project.engineAssociation,
      modules: ctx.project.modules,
    },
    engine: ctx.engine
      ? {
          version: ctx.engine.version,
          root: ctx.engine.root,
          ubtPath: ctx.engine.ubtPath,
        }
      : null,
    buildTools: ctx.buildTools
      ? {
          installationPath: ctx.buildTools.installationPath,
          displayName: ctx.buildTools.displayName,
        }
      : null,
    config: {
      buildConfiguration: settings.buildConfiguration,
      buildTarget: settings.buildTarget,
      platform: settings.platform,
    },
    lastBuild: ctx.lastBuildResult ?? null,
  };
}

function readRequestBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    req.on('error', reject);
  });
}

// --- Port file management ---

async function writePortFile(projectRoot: string, port: number): Promise<void> {
  const enginelinkDir = path.join(projectRoot, '.enginelink');
  await fs.promises.mkdir(enginelinkDir, { recursive: true });
  await fs.promises.writeFile(path.join(enginelinkDir, 'port'), port.toString(), 'utf-8');
}
