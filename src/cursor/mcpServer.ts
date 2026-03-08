import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { Commands } from '../constants';
import type { EngineLinkContext } from '../types';
import type { EngineLinkSettings } from '../config/settings';
import type { IPCStateUpdate } from '../mcp/protocol';

let mcpProcess: ChildProcess | null = null;

/**
 * Start the MCP server as a child process and register it in .cursor/mcp.json.
 */
export async function startMcpServer(
  extensionPath: string,
  ctx: EngineLinkContext,
  settings: EngineLinkSettings,
): Promise<void> {
  const serverPath = path.join(extensionPath, 'dist', 'mcp-server.js');

  // Check if the server bundle exists
  try {
    await fs.promises.access(serverPath);
  } catch {
    ctx.outputChannel.appendLine('[EngineLink] MCP server bundle not found. Skipping MCP registration.');
    return;
  }

  // Spawn the MCP server process
  mcpProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  });

  // Handle stderr (IPC messages from MCP server to extension)
  let stderrBuffer = '';
  mcpProcess.stderr?.on('data', (data: Buffer) => {
    stderrBuffer += data.toString();
    const lines = stderrBuffer.split('\n');
    stderrBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        handleMcpIPC(msg, ctx, settings);
      } catch {
        ctx.outputChannel.appendLine(`[EngineLink MCP] ${trimmed}`);
      }
    }
  });

  mcpProcess.on('error', (err) => {
    ctx.outputChannel.appendLine(`[EngineLink MCP] Process error: ${err.message}`);
  });

  mcpProcess.on('exit', (code) => {
    ctx.outputChannel.appendLine(`[EngineLink MCP] Process exited with code ${code}`);
    mcpProcess = null;
  });

  // Register in .cursor/mcp.json
  if (ctx.project) {
    await registerInCursorConfig(ctx.project.projectRoot, serverPath);
  }

  ctx.outputChannel.appendLine('[EngineLink] MCP server started.');
}

/**
 * Send state update to the MCP server process.
 */
export function sendStateToMcp(ctx: EngineLinkContext, settings: EngineLinkSettings): void {
  if (!mcpProcess?.stdin?.writable) return;

  const stateMsg: IPCStateUpdate = {
    type: 'ipc:stateUpdate',
    project: ctx.project
      ? {
          name: ctx.project.name,
          uprojectPath: ctx.project.uprojectPath,
          projectRoot: ctx.project.projectRoot,
          engineAssociation: ctx.project.engineAssociation,
          modules: ctx.project.modules,
        }
      : null,
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
    lastBuildErrors: ctx.lastBuildErrors,
    lastBuildResult: ctx.lastBuildResult ?? null,
  };

  mcpProcess.stdin.write(JSON.stringify(stateMsg) + '\n');
}

/**
 * Stop the MCP server process.
 */
export function stopMcpServer(): void {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
}

/**
 * Handle IPC messages from the MCP server (received via stderr).
 */
function handleMcpIPC(
  msg: { type: string; [key: string]: unknown },
  ctx: EngineLinkContext,
  settings: EngineLinkSettings,
) {
  switch (msg.type) {
    case 'ipc:ready':
      // Server is ready, send initial state
      sendStateToMcp(ctx, settings);
      break;

    case 'ipc:buildRequest':
      handleBuildRequest(msg as { type: string; action?: string; configuration?: string; targetType?: string }, ctx);
      break;

    case 'ipc:launchRequest':
      vscode.commands.executeCommand(Commands.LaunchEditor);
      sendResponseToMcp({
        type: 'ipc:genericResponse',
        requestType: 'launch',
        success: true,
        message: 'Unreal Editor launch requested.',
      });
      break;

    case 'ipc:liveCodingRequest':
      vscode.commands.executeCommand(Commands.LiveCoding);
      sendResponseToMcp({
        type: 'ipc:genericResponse',
        requestType: 'liveCoding',
        success: true,
        message: 'Live Coding compile triggered.',
      });
      break;

    case 'ipc:generateCompileCommandsRequest':
      vscode.commands.executeCommand(Commands.GenerateCompileCommands);
      sendResponseToMcp({
        type: 'ipc:genericResponse',
        requestType: 'generateCompileCommands',
        success: true,
        message: 'compile_commands.json generation started.',
      });
      break;
  }
}

async function handleBuildRequest(
  msg: { action?: string; configuration?: string; targetType?: string },
  ctx: EngineLinkContext,
) {
  const action = msg.action ?? 'build';

  switch (action) {
    case 'build':
      await vscode.commands.executeCommand(Commands.Build);
      break;
    case 'rebuild':
      await vscode.commands.executeCommand(Commands.Rebuild);
      break;
    case 'clean':
      await vscode.commands.executeCommand(Commands.Clean);
      break;
  }

  // After command completes, send result back
  sendResponseToMcp({
    type: 'ipc:buildResponse',
    success: ctx.lastBuildResult?.success ?? false,
    errors: ctx.lastBuildResult?.errors ?? 0,
    warnings: ctx.lastBuildResult?.warnings ?? 0,
    duration: ctx.lastBuildResult?.duration ?? 0,
    errorMessages: ctx.lastBuildErrors
      .filter((e) => e.severity === 'error')
      .map((e) => `${e.file}(${e.line}): ${e.code}: ${e.message}`),
  });
}

function sendResponseToMcp(msg: Record<string, unknown>) {
  if (!mcpProcess?.stdin?.writable) return;
  mcpProcess.stdin.write(JSON.stringify(msg) + '\n');
}

/**
 * Register the MCP server in .cursor/mcp.json so Cursor picks it up.
 */
async function registerInCursorConfig(projectRoot: string, serverPath: string): Promise<void> {
  const mcpConfigPath = path.join(projectRoot, '.cursor', 'mcp.json');

  let config: Record<string, unknown> = {};
  try {
    const existing = await fs.promises.readFile(mcpConfigPath, 'utf-8');
    config = JSON.parse(existing);
  } catch {
    // File doesn't exist yet
  }

  const mcpServers = (config.mcpServers ?? {}) as Record<string, unknown>;

  mcpServers['enginelink'] = {
    command: 'node',
    args: [serverPath],
  };

  config.mcpServers = mcpServers;

  const cursorDir = path.join(projectRoot, '.cursor');
  await fs.promises.mkdir(cursorDir, { recursive: true });
  await fs.promises.writeFile(mcpConfigPath, JSON.stringify(config, null, 2), 'utf-8');
}
