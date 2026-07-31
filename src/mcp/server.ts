/**
 * EngineLink MCP Server — standalone process.
 *
 * This runs as a child process spawned by Claude Code (via .mcp.json)
 * or Cursor (via .cursor/mcp.json). It handles the MCP protocol (JSON-RPC
 * over stdin/stdout) and forwards tool calls to the EngineLink VS Code
 * extension via HTTP on localhost.
 *
 * The extension writes its HTTP port to `<project>/.enginelink/port`.
 * This server reads that file on startup to discover the extension.
 *
 * Communication:
 * - MCP protocol (JSON-RPC) over stdin/stdout — for the AI editor
 * - HTTP REST to localhost:<port> — for the VS Code extension
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { TOOL_DEFINITIONS } from './tools';

// The extension's HTTP port, discovered from .enginelink/port
let extensionPort: number | null = null;
let projectRoot: string | null = null;

// Read stdin line by line (MCP JSON-RPC from Claude Code / Cursor)
let inputBuffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk: string) => {
  inputBuffer += chunk;
  const lines = inputBuffer.split('\n');
  inputBuffer = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const msg = JSON.parse(trimmed);

      // MCP JSON-RPC messages
      if (msg.jsonrpc === '2.0') {
        handleMCPMessage(msg);
      }
    } catch {
      // Ignore unparseable lines
    }
  }
});

// --- MCP message handling ---

function handleMCPMessage(msg: { id?: number | string; method: string; params?: unknown }) {
  switch (msg.method) {
    case 'initialize':
      respond(msg.id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'enginelink', version: '0.2.0' },
      });
      break;

    case 'notifications/initialized':
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

// --- HTTP forwarding to extension ---

function extensionUrl(endpoint: string): string {
  if (!extensionPort) {
    throw new Error('EngineLink extension not detected. Is the extension installed and activated?');
  }
  return `http://127.0.0.1:${extensionPort}${endpoint}`;
}

function httpGet(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    http
      .get(url, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON from extension: ${data.slice(0, 200)}`));
          }
        });
      })
      .on('error', reject)
      .on('timeout', function (this: http.ClientRequest) {
        this.destroy();
        reject(new Error('HTTP request timed out'));
      });
  });
}

function httpPost(url: string, body: unknown, timeoutMs: number = 300000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = http.request(
      url,
      {
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr).toString(),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON from extension: ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', function (this: http.ClientRequest) {
      this.destroy();
      reject(new Error('HTTP request timed out'));
    });
    req.write(bodyStr);
    req.end();
  });
}

// --- Tool call handling ---

async function handleToolCall(
  id: number | string | undefined,
  params: { name: string; arguments?: Record<string, unknown> },
) {
  const { name, arguments: args } = params;

  // Ensure extension port is discovered
  if (!extensionPort) {
    discoverExtensionPort();
  }

  if (!extensionPort) {
    respond(id, {
      content: [
        {
          type: 'text',
          text: 'EngineLink extension not detected. Make sure the EngineLink VS Code extension is installed and a UE project is open.',
        },
      ],
    });
    return;
  }

  try {
    switch (name) {
      case 'enginelink_get_project_info': {
        const info = await httpGet(extensionUrl('/state'));
        respond(id, {
          content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
        });
        break;
      }

      case 'enginelink_get_build_errors': {
        const errors = await httpGet(extensionUrl('/build-errors'));
        respond(id, {
          content: [{ type: 'text', text: typeof errors === 'string' ? errors : JSON.stringify(errors, null, 2) }],
        });
        break;
      }

      case 'enginelink_build':
      case 'enginelink_rebuild':
      case 'enginelink_clean': {
        const action = name.replace('enginelink_', '');
        const result = await httpPost(extensionUrl(`/${action}`), {
          configuration: args?.configuration,
          targetType: args?.targetType,
        });
        respond(id, {
          content: [{ type: 'text', text: (result as { message?: string })?.message ?? JSON.stringify(result) }],
        });
        break;
      }

      case 'enginelink_launch_editor': {
        const result = await httpPost(extensionUrl('/launch-editor'), {}, 10000);
        respond(id, {
          content: [{ type: 'text', text: (result as { message?: string })?.message ?? 'Launch request sent.' }],
        });
        break;
      }

      case 'enginelink_live_coding': {
        const result = await httpPost(extensionUrl('/live-coding'), {}, 10000);
        respond(id, {
          content: [{ type: 'text', text: (result as { message?: string })?.message ?? 'Live Coding request sent.' }],
        });
        break;
      }

      case 'enginelink_generate_compile_commands': {
        const result = await httpPost(extensionUrl('/generate-compile-commands'), {}, 300000);
        respond(id, {
          content: [
            { type: 'text', text: (result as { message?: string })?.message ?? 'Generate request sent.' },
          ],
        });
        break;
      }

      default:
        respondError(id, -32602, `Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    respond(id, {
      content: [{ type: 'text', text: `Error: ${message}` }],
    });
  }
}

// --- Port discovery ---

function discoverExtensionPort(): void {
  // Walk up from current directory to find .enginelink/port
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const portFile = path.join(dir, '.enginelink', 'port');
    try {
      const portStr = fs.readFileSync(portFile, 'utf-8').trim();
      const port = parseInt(portStr, 10);
      if (port > 0 && port < 65536) {
        extensionPort = port;
        projectRoot = dir;
        return;
      }
    } catch {
      // Not here, try parent
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

// --- JSON-RPC response helpers ---

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

// Discover extension port on startup
discoverExtensionPort();
if (extensionPort) {
  process.stderr.write(`[enginelink-mcp] Connected to extension on port ${extensionPort}\n`);
} else {
  process.stderr.write('[enginelink-mcp] Extension port not found. Waiting for first tool call to retry.\n');
}
