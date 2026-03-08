/**
 * MCP tool definitions for EngineLink.
 * These are exposed to Cursor's AI agent.
 */

export const TOOL_DEFINITIONS = [
  {
    name: 'enginelink_build',
    description:
      'Build the current Unreal Engine project. Optionally override the build configuration (Debug, DebugGame, Development, Shipping, Test) and target type (Editor, Game, Client, Server). Returns build result with any errors.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        configuration: {
          type: 'string',
          enum: ['Debug', 'DebugGame', 'Development', 'Shipping', 'Test'],
          description: 'Build configuration. Defaults to the current setting.',
        },
        targetType: {
          type: 'string',
          enum: ['Editor', 'Game', 'Client', 'Server'],
          description: 'Build target type. Defaults to the current setting.',
        },
      },
    },
  },
  {
    name: 'enginelink_clean',
    description: 'Clean build artifacts for the current Unreal Engine project.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'enginelink_rebuild',
    description: 'Clean and rebuild the current Unreal Engine project.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'enginelink_get_build_errors',
    description:
      'Get the current build errors from the last build. Returns a list of errors with file paths, line numbers, error codes, and messages. Use this to diagnose build failures.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'enginelink_get_project_info',
    description:
      'Get information about the current Unreal Engine project: project name, engine version, modules, build configuration, and status.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'enginelink_launch_editor',
    description: 'Launch the Unreal Editor for the current project.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'enginelink_live_coding',
    description:
      'Trigger a Live Coding compile (hot reload) in the running Unreal Editor. The editor must be running. Note: Live Coding cannot add/remove UPROPERTY or UFUNCTION members.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'enginelink_generate_compile_commands',
    description:
      'Regenerate compile_commands.json for the project. This enables accurate IntelliSense for Unreal Engine C++ code.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];
