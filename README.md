# EngineLink

**Cursor-first Unreal Engine build bridge** — build, launch, and live-code UE projects with AI-powered tooling.

EngineLink connects [Cursor](https://cursor.sh) (and VS Code) to Unreal Engine so you can compile, iterate, and debug C++ projects without leaving your editor. It auto-detects your `.uproject`, discovers engine installations from the Windows registry, and exposes every build action to Cursor's AI agent via a built-in [MCP](https://modelcontextprotocol.io/) server.

> **Status:** Early preview (`0.1.0`). Windows-only for now.

---

## Features

### Build Integration

- **Build / Rebuild / Clean** — invoke UnrealBuildTool directly from the editor with full output streaming
- **Live Coding** — trigger `Ctrl+Alt+F11` hot-reload in a running Unreal Editor session
- **Editor-aware builds** — detects when Unreal Editor is running and suggests Live Coding over a full build to avoid DLL lock errors
- **`compile_commands.json` generation** — runs UBT's `GenerateClangDatabase` mode and copies the result to your project root for accurate IntelliSense

### Auto-Detection

- **Project detection** — scans the workspace for `.uproject` files and parses `EngineAssociation`
- **Engine discovery** — reads the Windows registry (Epic Games Launcher installs and source builds) plus common installation paths
- **Build tools detection** — locates Visual Studio Build Tools via `vswhere`

### Cursor AI Integration

- **MCP server** — a sidecar process that exposes build, clean, rebuild, launch, live-coding, and diagnostics as MCP tools. Cursor's AI agent can compile your project, read build errors, and fix them autonomously
- **Cursor rules** — generates `.cursor/rules/*.mdc` files with UE naming conventions, reflection macros, build system patterns, and Live Coding limitations so the AI writes idiomatic Unreal C++

### Editor UX

- **Status bar** — shows project name, engine version, build configuration, and quick-action buttons
- **Problems panel** — MSVC and UBT errors/warnings are parsed and surfaced as native VS Code diagnostics
- **Progress notifications** — build progress is reported via both the status bar spinner and a notification toast
- **Task provider** — `enginelink` tasks are available in the Tasks panel and can be referenced from `tasks.json`

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Windows 10/11** | Registry-based engine discovery and PowerShell Live Coding are Windows-specific |
| **Unreal Engine 5.4+** | Tested with UE 5.4; earlier versions may work but are not officially supported |
| **Visual Studio Build Tools** | Required for MSVC compilation; detected automatically via `vswhere` |
| **Cursor or VS Code** | Engine version `^1.85.0` |

---

## Installation

### From Source

```bash
git clone https://github.com/rmoubayed/engine-link.git
cd engine-link
npm install
npm run build
```

Then press `F5` in Cursor/VS Code to launch the Extension Development Host, or package it:

```bash
npm run package
```

This produces an `enginelink-0.1.0.vsix` you can install with:

```bash
code --install-extension enginelink-0.1.0.vsix
```

### From Marketplace

*Not yet published. Coming soon.*

---

## Quick Start

1. Open a folder containing a `.uproject` file in Cursor
2. EngineLink activates automatically and runs its detection pipeline:
   - Finds your `.uproject` and parses its `EngineAssociation`
   - Discovers matching UE installations from the registry
   - Locates VS Build Tools
3. The status bar populates with your project name, engine version, and build actions
4. Press `Ctrl+Shift+B` to build or use the Command Palette (`Ctrl+Shift+P` → "EngineLink: Build")

If auto-detection fails, you can override paths in settings (see [Configuration](#configuration)).

---

## Commands

All commands are available via the Command Palette under the **EngineLink** category.

| Command | Keybinding | Description |
|---|---|---|
| **Build** | `Ctrl+Shift+B` | Build the project via UnrealBuildTool |
| **Rebuild (Clean + Build)** | — | Clean all artifacts then build |
| **Clean** | — | Remove build artifacts |
| **Launch Unreal Editor** | — | Open UnrealEditor.exe with the current project |
| **Live Coding Compile** | `Ctrl+Alt+F11` | Send a hot-reload keystroke to the running Unreal Editor |
| **Generate compile_commands.json** | — | Run UBT in `GenerateClangDatabase` mode |
| **Select Unreal Engine Installation** | — | Pick from discovered engine installs |
| **Select UE Project** | — | Pick from detected `.uproject` files |
| **Select Build Configuration** | — | Choose Debug / DebugGame / Development / Shipping / Test |
| **Select Build Target Type** | — | Choose Editor / Game / Client / Server |

Build, Launch, and Live Coding also appear as icon buttons in the editor title bar when a project is detected.

---

## Configuration

All settings are scoped under `enginelink.*` and can be set in your workspace or user `settings.json`.

| Setting | Type | Default | Description |
|---|---|---|---|
| `enginelink.engineRoot` | `string` | `""` | Manual override for the UE root directory. Leave empty for auto-detection. |
| `enginelink.projectFile` | `string` | `""` | Path to a specific `.uproject` file. Leave empty for auto-detection. |
| `enginelink.buildConfiguration` | `enum` | `Development` | Build configuration: `Debug`, `DebugGame`, `Development`, `Shipping`, `Test` |
| `enginelink.buildTarget` | `enum` | `Editor` | Build target type: `Editor`, `Game`, `Client`, `Server` |
| `enginelink.platform` | `string` | `Win64` | Target platform |
| `enginelink.autoGenerateCompileCommands` | `boolean` | `true` | Auto-generate `compile_commands.json` on project detection |
| `enginelink.liveCoding.method` | `enum` | `keystroke` | Live Coding trigger method (`keystroke` or `disabled`) |
| `enginelink.vsBuildTools.path` | `string` | `""` | Manual override for VS Build Tools install path |

---

## MCP Server (Cursor AI Integration)

EngineLink ships a built-in MCP server that lets Cursor's AI agent interact with your Unreal project. On activation, the server is spawned as a child process and registered in `.cursor/mcp.json`.

### Available MCP Tools

| Tool | Description |
|---|---|
| `enginelink_build` | Build the project (supports configuration and target overrides) |
| `enginelink_rebuild` | Clean and rebuild |
| `enginelink_clean` | Clean build artifacts |
| `enginelink_get_build_errors` | Retrieve errors from the last build with file paths, line numbers, and messages |
| `enginelink_get_project_info` | Get project name, engine version, modules, and current build settings |
| `enginelink_launch_editor` | Launch Unreal Editor |
| `enginelink_live_coding` | Trigger a Live Coding hot-reload |
| `enginelink_generate_compile_commands` | Regenerate `compile_commands.json` |

This means you can tell Cursor's agent things like *"build my project and fix any errors"* and it will invoke UBT, read the diagnostics, and propose fixes — all within the chat.

---

## Cursor Rules

On project detection, EngineLink generates `.cursor/rules/*.mdc` files (if they don't already exist) so the AI follows Unreal conventions:

| Rule File | Covers |
|---|---|
| `unreal-conventions.mdc` | Class prefixes (`U`, `A`, `F`, `E`, `I`, `T`), PascalCase, UE container types |
| `unreal-macros.mdc` | `UCLASS`, `UPROPERTY`, `UFUNCTION`, `USTRUCT`, `UENUM`, `GENERATED_BODY` |
| `unreal-build-system.mdc` | `.Build.cs`, `.Target.cs`, module structure, dependency management |
| `unreal-live-coding.mdc` | What Live Coding can and cannot patch at runtime |
| `unreal-patterns.mdc` | Delegates, timers, subsystems, Gameplay Tags, Enhanced Input, logging, actor spawning |

These files are never overwritten, so you can customize them freely.

---

## Task Provider

EngineLink registers an `enginelink` task type. You can reference it in `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "enginelink",
      "action": "build",
      "configuration": "Development",
      "targetType": "Editor",
      "label": "EngineLink: Build Editor (Development)"
    },
    {
      "type": "enginelink",
      "action": "clean",
      "label": "EngineLink: Clean"
    },
    {
      "type": "enginelink",
      "action": "generateCompileCommands",
      "label": "EngineLink: Generate compile_commands.json"
    }
  ]
}
```

Two problem matchers are also provided — `$enginelink-msvc` and `$enginelink-ubt` — for parsing MSVC and UnrealBuildTool output respectively.

---

## Project Structure

```
src/
├── extension.ts                  # Entry point — activation, command registration, detection pipeline
├── constants.ts                  # IDs, command names, config keys, registry paths
├── types.ts                      # Shared TypeScript interfaces
├── build/
│   ├── ubt.ts                    # UBT command-line construction
│   └── taskProvider.ts           # VS Code task provider
├── commands/
│   ├── buildCommands.ts          # Build, rebuild, clean execution
│   ├── launchCommands.ts         # Launch Unreal Editor
│   ├── liveCodingCommand.ts      # Live Coding keystroke simulation
│   └── generateCommands.ts       # compile_commands.json generation
├── config/
│   └── settings.ts               # Typed settings accessor
├── cursor/
│   ├── mcpServer.ts              # MCP server lifecycle and IPC
│   └── rulesGenerator.ts         # .cursor/rules/*.mdc generation
├── detection/
│   ├── projectDetector.ts        # .uproject scanning and selection
│   ├── engineDiscovery.ts        # Engine discovery (registry + filesystem)
│   └── buildToolsDetector.ts     # VS Build Tools detection via vswhere
├── mcp/
│   ├── server.ts                 # Standalone MCP server process
│   ├── tools.ts                  # MCP tool definitions
│   └── protocol.ts               # IPC message types
├── parsers/
│   ├── buildOutputParser.ts      # MSVC / UBT / linker output parsing
│   └── uprojectParser.ts         # .uproject JSON parsing
├── platform/
│   ├── process.ts                # spawnAsync, isUnrealEditorRunning
│   ├── paths.ts                  # File/directory existence helpers, UBT/Editor path resolution
│   └── registry.ts               # Windows registry read utilities
└── ui/
    ├── statusBar.ts              # Status bar items
    ├── outputChannel.ts          # Output channel factory
    └── sidebarProvider.ts        # Webview sidebar (WIP)
```

---

## Development

### Building

```bash
npm install
npm run build        # one-shot build
npm run watch        # rebuild on change
```

The build is handled by [esbuild](https://esbuild.github.io/) and produces two bundles in `dist/`:

- `extension.js` — the main extension
- `mcp-server.js` — the standalone MCP server process

### Running Locally

1. Open this repo in Cursor / VS Code
2. Press `F5` to launch the Extension Development Host
3. Open a folder containing a `.uproject` file in the new window

### Linting & Formatting

```bash
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript type checking
```

### Testing

```bash
npm run test         # Vitest
```

### Packaging

```bash
npm run package      # produces .vsix via vsce
```

---

## Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `npm run lint && npm run typecheck` to verify
5. Commit and push to your fork
6. Open a pull request

### Areas where help is needed

- **macOS / Linux support** — engine discovery, process detection, and Live Coding are currently Windows-only
- **Test coverage** — the test infrastructure is in place (Vitest) but no tests have been written yet
- **Sidebar UI** — a webview sidebar provider exists but is not yet registered
- **UE version support** — testing and adapting for UE versions before 5.4

---

## License

[MIT](LICENSE) &copy; 2026 EngineLink
