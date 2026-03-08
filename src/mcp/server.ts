/**
 * EngineLink MCP Server — standalone process.
 *
 * This runs as a child process spawned by the extension.
 * It exposes build tools and project state to Cursor's AI agent via MCP protocol.
 *
 * Communication:
 * - MCP protocol (JSON-RPC) over stdin/stdout for Cursor AI interaction
 * - IPC messages (prefixed) from the extension host for state updates
 *
 * Note: This is a simplified MCP server implementation.
 * It reads JSON-RPC messages from stdin and writes responses to stdout.
 */

import { TOOL_DEFINITIONS } from './tools';
import type { IPCStateUpdate, IPCBuildResponse, IPCGenericResponse } from './protocol';

// Server state (populated via IPC from extension host)
let state: IPCStateUpdate | null = null;

// Pending IPC callbacks
const pendingCallbacks = new Map<string, (response: IPCBuildResponse | IPCGenericResponse) => void>();

// Read stdin line by line
let inputBuffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk: string) => {
  inputBuffer += chunk;
  const lines = inputBuffer.split('\n');
  inputBuffer = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    handleInput(trimmed);
  }
});

function handleInput(line: string) {
  try {
    const msg = JSON.parse(line);

    // IPC messages from extension host
    if (msg.type?.startsWith('ipc:')) {
      handleIPC(msg);
      return;
    }

    // MCP JSON-RPC messages from Cursor
    if (msg.jsonrpc === '2.0') {
      handleMCPMessage(msg);
      return;
    }
  } catch {
    // Ignore unparseable lines
  }
}

function handleIPC(msg: IPCStateUpdate | IPCBuildResponse | IPCGenericResponse) {
  if (msg.type === 'ipc:stateUpdate') {
    state = msg as IPCStateUpdate;
    return;
  }

  if (msg.type === 'ipc:buildResponse' || msg.type === 'ipc:genericResponse') {
    const callback = pendingCallbacks.get(msg.type);
    if (callback) {
      callback(msg as IPCBuildResponse | IPCGenericResponse);
      pendingCallbacks.delete(msg.type);
    }
    return;
  }
}

function handleMCPMessage(msg: { id?: number | string; method: string; params?: unknown }) {
  switch (msg.method) {
    case 'initialize':
      respond(msg.id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'enginelink', version: '0.1.0' },
      });
      break;

    case 'notifications/initialized':
      // No response needed for notifications
      break;

    case 'tools/list':
      respond(msg.id, { tools: TOOL_DEFINITIONS });
      break;

    case 'tools/call':
      handleToolCall(msg.id, msg.params as { name: string; arguments?: Record<string, unknown> });
      break;

    default:
      respondError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

async function handleToolCall(
  id: number | string | undefined,
  params: { name: string; arguments?: Record<string, unknown> },
) {
  const { name, arguments: args } = params;

  switch (name) {
    case 'enginelink_get_project_info': {
      if (!state || !state.project) {
        respond(id, {
          content: [{ type: 'text', text: 'No Unreal Engine project is currently detected.' }],
        });
        return;
      }

      const info = {
        project: state.project,
        engine: state.engine,
        buildTools: state.buildTools,
        config: state.config,
        lastBuild: state.lastBuildResult,
      };

      respond(id, {
        content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
      });
      break;
    }

    case 'enginelink_get_build_errors': {
      if (!state) {
        respond(id, {
          content: [{ type: 'text', text: 'EngineLink is not initialized.' }],
        });
        return;
      }

      if (state.lastBuildErrors.length === 0) {
        respond(id, {
          content: [{ type: 'text', text: 'No build errors. The last build succeeded or no build has been run yet.' }],
        });
        return;
      }

      const errorText = state.lastBuildErrors
        .map((e) => `${e.file}(${e.line},${e.column}): ${e.severity} ${e.code}: ${e.message}`)
        .join('\n');

      respond(id, {
        content: [{ type: 'text', text: errorText }],
      });
      break;
    }

    case 'enginelink_build':
    case 'enginelink_rebuild':
    case 'enginelink_clean': {
      const action = name.replace('enginelink_', '') as 'build' | 'rebuild' | 'clean';
      sendToExtension({
        type: 'ipc:buildRequest',
        action,
        configuration: args?.configuration as string | undefined,
        targetType: args?.targetType as string | undefined,
      });

      // Wait for response from extension (with timeout)
      const buildResult = await waitForResponse<IPCBuildResponse>('ipc:buildResponse', 300000);

      if (buildResult) {
        const text = buildResult.success
          ? `Build succeeded in ${(buildResult.duration / 1000).toFixed(1)}s (${buildResult.warnings} warnings)`
          : `Build failed in ${(buildResult.duration / 1000).toFixed(1)}s with ${buildResult.errors} error(s):\n${buildResult.errorMessages.join('\n')}`;

        respond(id, { content: [{ type: 'text', text }] });
      } else {
        respond(id, {
          content: [{ type: 'text', text: 'Build timed out or failed to communicate with extension.' }],
        });
      }
      break;
    }

    case 'enginelink_launch_editor': {
      sendToExtension({ type: 'ipc:launchRequest' });
      const result = await waitForResponse<IPCGenericResponse>('ipc:genericResponse', 10000);
      respond(id, {
        content: [{ type: 'text', text: result?.message ?? 'Launch request sent.' }],
      });
      break;
    }

    case 'enginelink_live_coding': {
      sendToExtension({ type: 'ipc:liveCodingRequest' });
      const result = await waitForResponse<IPCGenericResponse>('ipc:genericResponse', 10000);
      respond(id, {
        content: [{ type: 'text', text: result?.message ?? 'Live Coding request sent.' }],
      });
      break;
    }

    case 'enginelink_generate_compile_commands': {
      sendToExtension({ type: 'ipc:generateCompileCommandsRequest' });
      const result = await waitForResponse<IPCGenericResponse>('ipc:genericResponse', 300000);
      respond(id, {
        content: [{ type: 'text', text: result?.message ?? 'Generate request sent.' }],
      });
      break;
    }

    default:
      respondError(id, -32602, `Unknown tool: ${name}`);
  }
}

function respond(id: number | string | undefined, result: unknown) {
  if (id === undefined) return;
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(msg + '\n');
}

function respondError(id: number | string | undefined, code: number, message: string) {
  if (id === undefined) return;
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(msg + '\n');
}

function sendToExtension(msg: Record<string, unknown>) {
  // Write to stderr so it doesn't interfere with MCP stdout
  process.stderr.write(JSON.stringify(msg) + '\n');
}

function waitForResponse<T>(type: string, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingCallbacks.delete(type);
      resolve(null);
    }, timeoutMs);

    pendingCallbacks.set(type, (response) => {
      clearTimeout(timer);
      resolve(response as T);
    });
  });
}

// Indicate server is ready
sendToExtension({ type: 'ipc:ready' });
