/**
 * MCP server registration abstraction.
 *
 * Registers the EngineLink MCP server in the appropriate editor config file
 * based on the active AI assistant (Cursor vs Claude Code).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AIAssistant } from './editorDetect';

/**
 * Register the MCP server entry in the appropriate config file for the AI assistant.
 *
 * - cursor → .cursor/mcp.json
 * - claude  → .mcp.json (project root)
 * - none    → skips (logs handled by caller)
 */
export async function registerMcpServer(
  projectRoot: string,
  serverPath: string,
  assistant: AIAssistant,
): Promise<void> {
  switch (assistant) {
    case 'cursor':
      await writeMcpConfig(path.join(projectRoot, '.cursor', 'mcp.json'), serverPath);
      break;
    case 'claude':
      // Claude Code reads .mcp.json at the project root
      await writeMcpConfig(path.join(projectRoot, '.mcp.json'), serverPath);
      break;
    case 'none':
      // No MCP config written; caller should inform the user
      break;
  }
}

async function writeMcpConfig(
  mcpConfigPath: string,
  serverPath: string,
): Promise<void> {
  let config: Record<string, unknown> = {};
  try {
    const existing = await fs.promises.readFile(mcpConfigPath, 'utf-8');
    config = JSON.parse(existing);
  } catch {
    // File doesn't exist yet — start fresh
  }

  const mcpServers = (config.mcpServers ?? {}) as Record<string, unknown>;

  mcpServers['enginelink'] = {
    command: 'node',
    args: [serverPath],
  };

  config.mcpServers = mcpServers;

  const dir = path.dirname(mcpConfigPath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(mcpConfigPath, JSON.stringify(config, null, 2), 'utf-8');
}
