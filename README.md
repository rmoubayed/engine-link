# EngineLink

🌐 [enginelink.dev](https://enginelink.dev)

**Unreal Engine build bridge for AI-powered editors** — build, launch, and live-code UE projects with MCP tooling in Cursor and Claude Code.

EngineLink connects your AI editor to Unreal Engine so you can compile, iterate, and debug C++ projects without leaving the editor. It auto-detects your `.uproject`, discovers engine installations from the Windows registry, and exposes every build action to the AI agent via a built-in [MCP](https://modelcontextprotocol.io/) server.

> 🧪 **Status:** Early preview. Windows-only for now.

> 👋 **TL;DR:** I've been building software for 10 years but game dev is new to me. As I learn Unreal Engine, I found Rider and Visual Studio to be old-fashioned compared to modern AI-first editors — so I decided to give AI editors full UE capabilities. I'm testing this extension as I go, learning and breaking things along the way. Contributions and feedback are very welcome :)

---

## Supported Editors

| Editor | AI Assistant | MCP Config | Rules |
|---|---|---|---|
| **Cursor** | Cursor AI Agent | `.cursor/mcp.json` | `.cursor/rules/*.mdc` |
| **VS Code** | Claude Code | `.mcp.json` | `CLAUDE.md` |

EngineLink auto-detects which editor you're using. You can override this with the `enginelink.aiAssistant` setting (`"auto"`, `"cursor"`, or `"claude"`).

---

## Setup Guide

Getting EngineLink running is a three-step process: install the system prerequisites, install EngineLink, then install the C/C++ extension for IntelliSense.

### Step 1 — System Prerequisites

You need **Windows**, **Unreal Engine**, and **Visual Studio** with the right components.

#### Unreal Engine 5.4+

Install via the [Epic Games Launcher](https://www.unrealengine.com/). EngineLink has been tested on **UE 5.4 – 5.7**.

#### Visual Studio with C++ and Clang

Open **Visual Studio Installer**, click **Modify** on your install (Community / Build Tools / etc.), and make sure these components are enabled:

**Workload:**
- **Desktop development with C++** (this gives you MSVC, Windows SDK, and the core build tools UE needs)

**Individual Components** (search in the installer):
- **C++ Clang Compiler for Windows** — needed by UBT to generate `compile_commands.json` for IntelliSense
- **MSBuild support for LLVM (clang-cl) toolset** *(optional but recommended)*

> If you skip Clang, EngineLink will still build your project fine (UE uses MSVC), but `compile_commands.json` generation will fail and you won't get full IntelliSense. You can always add Clang later.

#### Editor

**Cursor:** Install [Cursor](https://cursor.sh) (version `1.85.0` or later).

**VS Code + Claude Code:** Install [VS Code](https://code.visualstudio.com/) (version `1.85.0` or later), then install the [Claude Code extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code).

---

### Step 2 — Install EngineLink

**From Marketplace** — *coming soon.*

**From VSIX** — download or build the `.vsix`, then in your editor: **Extensions → ... → Install from VSIX...**

**From Source:**

```bash
git clone https://github.com/rmoubayed/engine-link.git
cd engine-link
npm install
npm run build
```

Press `F5` to launch the Extension Development Host, or package it with `npm run package`.

---

### Step 3 — C/C++ IntelliSense

EngineLink handles **building** your project, but you need a language server for **IntelliSense** (code completion, go-to-definition, diagnostics on the fly).

Install a clangd-based C/C++ extension:

- **Cursor:** Install [C/C++ for Cursor](https://marketplace.visualstudio.com/items?itemName=anysphere.cpptools) — Cursor's official C/C++ extension with clangd under the hood.
- **VS Code:** Install [clangd](https://marketplace.visualstudio.com/items?itemName=llvm-vs-code-extensions.vscode-clangd) by LLVM, or [C/C++](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) by Microsoft.

#### Where `compile_commands.json` lives

UnrealBuildTool often writes the database next to the **engine** (e.g. `UE_5.7\compile_commands.json`). **EngineLink always copies it to your `.uproject` folder** as `compile_commands.json` at the **project root** after a successful run, so **clangd** can find it when you open files under `Source/` (it walks up to the workspace root).

If IntelliSense still cannot find the compilation database (e.g. generation failed or you use a non-standard layout), you can point clangd at the engine folder manually in **`.vscode/settings.json`**:

```json
{
  "clangd.arguments": [
    "--compile-commands-dir=C:/Program Files/Epic Games/UE_5.7"
  ]
}
```

Use the **directory** that contains `compile_commands.json`, forward slashes, then reload the window.

#### MSVC intrinsic false positives (builtin_definition)

When clangd parses UE code with MSVC-style headers, you may see **"definition of builtin function"** errors on system headers. This is a known clangd/MSVC quirk, not an error in your code — the real UE build is unaffected.

**EngineLink handles this automatically.** On activation it upserts a managed block in your project's `.clangd` file:

```yaml
# <<< enginelink-managed >>>
Diagnostics:
  Suppress: builtin_definition
# <<< end-enginelink-managed >>>
```

This only suppresses that one diagnostic class. EngineLink replaces only its own managed region and won't touch the rest of your `.clangd`. To disable: set `enginelink.upsertClangdConfig` to `false`.

---

## Quick Start

Once everything is installed:

1. Open a folder containing a `.uproject` file in your editor
2. EngineLink activates automatically and:
   - Finds your `.uproject` and parses `EngineAssociation`
   - Discovers the matching UE installation from the registry
   - Locates VS Build Tools
   - Generates AI rules (`.cursor/rules/*.mdc` for Cursor, `CLAUDE.md` for Claude Code)
   - Generates `compile_commands.json` (if Clang is installed)
   - Creates/updates `.clangd` for MSVC suppression
   - Registers the MCP server in `.cursor/mcp.json` or `.mcp.json`
3. The status bar shows your project name, engine version, and build actions
4. Press **`Ctrl+Shift+B`** to build

If auto-detection fails, override paths in [Configuration](#configuration).

---

## Features

### Build Integration

- **Build / Rebuild / Clean** — invoke UnrealBuildTool directly with full output streaming
- **Live Coding** (`Ctrl+Alt+F11`) — hot-reload in a running Unreal Editor session
- **Editor-aware builds** — detects when Unreal Editor is running and suggests Live Coding over a full build to avoid DLL lock errors
- **`compile_commands.json`** — auto-generates via UBT's `GenerateClangDatabase` mode
- **`.clangd` management** — suppresses MSVC/Clang `builtin_definition` false positives

### Auto-Detection

- **Project** — scans workspace for `.uproject` files, parses `EngineAssociation`
- **Engine** — reads Windows registry (launcher + source builds) and common paths
- **Build tools** — locates Visual Studio via `vswhere`

### AI Integration

- **MCP server** — exposes build, clean, rebuild, launch, live-coding, diagnostics, and project info as MCP tools for both Cursor's AI agent and Claude Code
- **Editor auto-detection** — automatically generates the right config format for your editor (`.cursor/mcp.json` or `.mcp.json`)
- **AI rules** — generates `.cursor/rules/*.mdc` for Cursor or `CLAUDE.md` for Claude Code so the AI writes idiomatic Unreal C++

### Editor UX

- **Status bar** — project name, engine version, build config, and action buttons
- **Problems panel** — MSVC and UBT errors surfaced as native diagnostics
- **Progress notifications** — build progress via spinner and toast
- **Task provider** — `enginelink` tasks for the Tasks panel and `tasks.json`

---

## Commands

| Command | Keybinding | Description |
|---|---|---|
| **Build** | `Ctrl+Shift+B` | Build the project via UnrealBuildTool |
| **Rebuild (Clean + Build)** | — | Clean all artifacts then build |
| **Clean** | — | Remove build artifacts |
| **Launch Unreal Editor** | — | Open UnrealEditor.exe with the current project |
| **Live Coding Compile** | `Ctrl+Alt+F11` | Hot-reload in the running Unreal Editor |
| **Generate compile_commands.json** | — | Run UBT `GenerateClangDatabase` |
| **Select Engine Installation** | — | Pick from discovered engine installs |
| **Select UE Project** | — | Pick from detected `.uproject` files |
| **Select Build Configuration** | — | Debug / DebugGame / Development / Shipping / Test |
| **Select Build Target Type** | — | Editor / Game / Client / Server |

Build, Launch, and Live Coding also appear as icon buttons in the editor title bar.

---

## Configuration

All settings live under `enginelink.*` in your workspace or user `settings.json`.

| Setting | Type | Default | Description |
|---|---|---|---|
| `enginelink.engineRoot` | `string` | `""` | Manual override for the UE root directory |
| `enginelink.projectFile` | `string` | `""` | Path to a specific `.uproject` file |
| `enginelink.buildConfiguration` | `enum` | `Development` | `Debug`, `DebugGame`, `Development`, `Shipping`, `Test` |
| `enginelink.buildTarget` | `enum` | `Editor` | `Editor`, `Game`, `Client`, `Server` |
| `enginelink.platform` | `string` | `Win64` | Target platform |
| `enginelink.aiAssistant` | `enum` | `auto` | `auto` (detect), `cursor`, or `claude` |
| `enginelink.autoGenerateCompileCommands` | `boolean` | `true` | Auto-generate `compile_commands.json` on detection (needs Clang) |
| `enginelink.upsertClangdConfig` | `boolean` | `true` | Auto-update `.clangd` with `builtin_definition` suppression |
| `enginelink.liveCoding.method` | `enum` | `keystroke` | Live Coding trigger (`keystroke` or `disabled`) |
| `enginelink.vsBuildTools.path` | `string` | `""` | Manual override for VS Build Tools path |

---

## MCP Server (AI Agent Tools)

EngineLink ships a built-in MCP server that AI agents can call directly. It's spawned on activation and registered in the appropriate config file for your editor.

| Tool | Description |
|---|---|
| `enginelink_build` | Build (optional config/target overrides) |
| `enginelink_rebuild` | Clean + build |
| `enginelink_clean` | Clean build artifacts |
| `enginelink_get_build_errors` | Errors with file paths, lines, and messages |
| `enginelink_get_project_info` | Project name, engine version, modules, settings |
| `enginelink_launch_editor` | Launch Unreal Editor |
| `enginelink_live_coding` | Trigger Live Coding hot-reload |
| `enginelink_generate_compile_commands` | Regenerate `compile_commands.json` |

---

## AI Rules

On project detection, EngineLink generates guidance files so the AI follows UE conventions. The format depends on your editor:

### Cursor (`.cursor/rules/*.mdc`)

| Rule File | Covers |
|---|---|
| `unreal-conventions.mdc` | Class prefixes (`U`, `A`, `F`, `E`, `I`, `T`), PascalCase, UE types |
| `unreal-macros.mdc` | `UCLASS`, `UPROPERTY`, `UFUNCTION`, `USTRUCT`, `UENUM` |
| `unreal-build-system.mdc` | `.Build.cs`, `.Target.cs`, modules, plugins |
| `unreal-live-coding.mdc` | What Live Coding can and cannot hot-patch |
| `unreal-patterns.mdc` | Delegates, timers, subsystems, Gameplay Tags, Enhanced Input, logging |

### Claude Code (`CLAUDE.md`)

A single `CLAUDE.md` at the project root combines all the guidance above into one file. Claude Code reads this automatically for project context.

> Existing files are never overwritten — EngineLink only creates rules if they don't exist yet, so your customizations are safe.

> **This is where we need the most help.** If you're an experienced UE developer, your feedback on these rules would be incredibly valuable — please open an issue or PR!

---

## Task Provider

EngineLink registers an `enginelink` task type for `.vscode/tasks.json`:

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
    }
  ]
}
```

Problem matchers `$enginelink-msvc` and `$enginelink-ubt` are included for parsing build output.

---

## Contributing

This project is early and there's a lot to improve. Jump in!

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `npm run typecheck`
5. Open a pull request

**Areas where help is needed:**
- **Testing** — Vitest is set up but no tests exist yet
- **AI rules** — UE experts: are the rules correct? What's missing?
- **macOS / Linux** — engine discovery and Live Coding are Windows-only right now

---

## Project Structure

```
src/
├── extension.ts                  # Entry point — activation, command registration
├── constants.ts                  # IDs, command names, config keys
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
├── ai/
│   ├── mcpServer.ts              # MCP server lifecycle and IPC
│   ├── mcpRegistration.ts        # MCP config registration (Cursor / Claude)
│   ├── editorDetect.ts           # AI assistant auto-detection
│   ├── cursorRulesGenerator.ts   # .cursor/rules/*.mdc generation
│   ├── claudeRulesGenerator.ts   # CLAUDE.md generation
│   └── clangdConfig.ts           # .clangd managed block upsert
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
│   ├── paths.ts                  # File/directory helpers
│   └── registry.ts               # Windows registry read utilities
└── ui/
    ├── statusBar.ts              # Status bar items
    ├── outputChannel.ts          # Output channel factory
    └── quickPicks.ts             # Quick-pick menus
```

---

## Development

```bash
npm install
npm run build        # one-shot build
npm run watch        # rebuild on change
npm run format       # Prettier
npm run typecheck    # TypeScript type checking
npm run test         # Vitest
npm run package      # produces .vsix via vsce
```

Built with [esbuild](https://esbuild.github.io/) — produces `dist/extension.js` and `dist/mcp-server.js`.

To run locally: open this repo in Cursor or VS Code, press `F5`, then open a UE project folder in the new window.

---

## License

[MIT](LICENSE) &copy; 2026 EngineLink
