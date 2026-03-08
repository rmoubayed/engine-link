# EngineLink

🌐 [enginelink.dev](https://enginelink.dev)

**Cursor-first Unreal Engine build bridge** — build, launch, and live-code UE projects with AI-powered tooling.

EngineLink connects [Cursor](https://cursor.sh) (and VS Code) to Unreal Engine so you can compile, iterate, and debug C++ projects without leaving your editor. It auto-detects your `.uproject`, discovers engine installations from the Windows registry, and exposes every build action to Cursor's AI agent via a built-in [MCP](https://modelcontextprotocol.io/) server.

> 🧪 **Status:** Early preview (`0.1.0`). Windows-only for now.

> 👋 **TL;DR:** This is a fun experiment! I've been building software for 10 years but game dev is new to me. As I learn Unreal Engine, I found Rider and Visual Studio to be very old-fashioned compared to modern AI-first editors — so I decided to give Cursor full UE capabilities. I'm testing this extension as I go, learning and breaking things along the way. Contributions and feedback are very welcome :)

---

## 🙏 Contributing & Help Wanted

This project is early and there's a lot to improve. If any of this interests you, jump in!

### 📐 Cursor Rules & UE Best Practices (feedback needed most!)

EngineLink auto-generates `.cursor/rules/*.mdc` files that teach Cursor's AI how to write idiomatic Unreal C++. **This is where we need the most help** — if you're an experienced UE developer, your feedback on these rules would be incredibly valuable:

| Rule File | What it covers |
|---|---|
| `unreal-conventions.mdc` | Class prefixes (`U`, `A`, `F`, `E`, `I`, `T`), PascalCase, UE container types |
| `unreal-macros.mdc` | `UCLASS`, `UPROPERTY`, `UFUNCTION`, `USTRUCT`, `UENUM`, `GENERATED_BODY` |
| `unreal-build-system.mdc` | `.Build.cs`, `.Target.cs`, module structure, dependency management |
| `unreal-live-coding.mdc` | What Live Coding can and cannot patch at runtime |
| `unreal-patterns.mdc` | Delegates, timers, subsystems, Gameplay Tags, Enhanced Input, logging |

> 💡 These files are never overwritten once generated, so you can customize them freely. If you know UE well and think a rule is wrong or missing — please open an issue or PR!

### 🧩 Other areas where help is needed

- 🧪 **Testing** — Vitest is set up but no tests exist yet. This is the biggest code gap: unit tests for detection, build commands, output parsing, and integration tests against real UE projects

### How to contribute

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `npm run lint && npm run typecheck` to verify
5. Open a pull request

---

## ✨ Features

### 🔨 Build Integration

- **Build / Rebuild / Clean** — invoke UnrealBuildTool directly from the editor with full output streaming
- **⚡ Live Coding** — trigger `Ctrl+Alt+F11` hot-reload in a running Unreal Editor session
- **🧠 Editor-aware builds** — detects when Unreal Editor is running and suggests Live Coding over a full build to avoid DLL lock errors
- **📄 `compile_commands.json` generation** — runs UBT's `GenerateClangDatabase` mode for accurate IntelliSense

### 🔍 Auto-Detection

- **Project detection** — scans the workspace for `.uproject` files and parses `EngineAssociation`
- **Engine discovery** — reads the Windows registry (Epic Games Launcher + source builds) plus common paths
- **Build tools detection** — locates Visual Studio Build Tools via `vswhere`

### 🤖 Cursor AI Integration

- **MCP server** — a sidecar process that exposes build, clean, rebuild, launch, live-coding, and diagnostics as MCP tools. Cursor's AI agent can compile your project, read build errors, and fix them autonomously
- **Cursor rules** — generates `.cursor/rules/*.mdc` files so the AI writes idiomatic Unreal C++ (see [Contributing](#-contributing--help-wanted) above)

### 🖥️ Editor UX

- **Status bar** — Rider-style toolbar with project name, engine version, build config, and colored action buttons
- **Problems panel** — MSVC and UBT errors/warnings are parsed and surfaced as native VS Code diagnostics
- **Progress notifications** — build progress via status bar spinner and notification toast
- **Task provider** — `enginelink` tasks available in the Tasks panel and `tasks.json`

---

## 📋 Prerequisites

| Requirement | Notes |
|---|---|
| 🪟 **Windows 10/11** | Registry-based engine discovery and PowerShell Live Coding are Windows-specific |
| 🎮 **Unreal Engine 5.4+** | Tested with UE 5.4; earlier versions may work but aren't officially supported |
| 🔧 **Visual Studio Build Tools** | Required for MSVC compilation; detected automatically via `vswhere` |
| ✏️ **Cursor or VS Code** | Engine version `^1.85.0` |

---

## 🚀 Installation

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

## ⚡ Quick Start

1. Open a folder containing a `.uproject` file in Cursor
2. EngineLink activates automatically and runs its detection pipeline:
   - 📁 Finds your `.uproject` and parses its `EngineAssociation`
   - 🔍 Discovers matching UE installations from the registry
   - 🔧 Locates VS Build Tools
3. The status bar populates with your project name, engine version, and build actions
4. Press `Ctrl+Shift+B` to build or use the Command Palette (`Ctrl+Shift+P` → "EngineLink: Build")

If auto-detection fails, you can override paths in settings (see [Configuration](#%EF%B8%8F-configuration)).

---

## 🎮 Commands

All commands are available via the Command Palette under the **EngineLink** category.

| Command | Keybinding | Description |
|---|---|---|
| **▶ Build** | `Ctrl+Shift+B` | Build the project via UnrealBuildTool |
| **↻ Rebuild** | — | Clean all artifacts then build |
| **✕ Clean** | — | Remove build artifacts |
| **🚀 Launch Unreal Editor** | — | Open UnrealEditor.exe with the current project |
| **⚡ Live Coding Compile** | `Ctrl+Alt+F11` | Send a hot-reload keystroke to the running Unreal Editor |
| **📄 Generate compile_commands.json** | — | Run UBT in `GenerateClangDatabase` mode |
| **Select Engine Installation** | — | Pick from discovered engine installs |
| **Select UE Project** | — | Pick from detected `.uproject` files |
| **Select Build Configuration** | — | Choose Debug / DebugGame / Development / Shipping / Test |
| **Select Build Target Type** | — | Choose Editor / Game / Client / Server |

Build, Launch, and Live Coding also appear as icon buttons in the editor title bar when a project is detected.

---

## ⚙️ Configuration

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

## 🤖 MCP Server

EngineLink ships a built-in MCP server that lets Cursor's AI agent interact with your Unreal project. On activation, the server is spawned as a child process and registered in `.cursor/mcp.json`.

| Tool | Description |
|---|---|
| `enginelink_build` | Build the project (supports configuration and target overrides) |
| `enginelink_rebuild` | Clean and rebuild |
| `enginelink_clean` | Clean build artifacts |
| `enginelink_get_build_errors` | Retrieve errors with file paths, line numbers, and messages |
| `enginelink_get_project_info` | Get project name, engine version, modules, and build settings |
| `enginelink_launch_editor` | Launch Unreal Editor |
| `enginelink_live_coding` | Trigger a Live Coding hot-reload |
| `enginelink_generate_compile_commands` | Regenerate `compile_commands.json` |

> 💬 Tell Cursor things like *"build my project and fix any errors"* and it will invoke UBT, read the diagnostics, and propose fixes — all within the chat.

---

## 📝 Task Provider

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
    }
  ]
}
```

Two problem matchers are also provided — `$enginelink-msvc` and `$enginelink-ubt` — for parsing MSVC and UnrealBuildTool output.

---

## 📂 Project Structure

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
│   ├── paths.ts                  # File/directory helpers, UBT/Editor path resolution
│   └── registry.ts               # Windows registry read utilities
└── ui/
    ├── statusBar.ts              # Status bar items
    ├── outputChannel.ts          # Output channel factory
    └── quickPicks.ts             # Quick-pick menus for config selection
```

---

## 🛠️ Development

```bash
npm install
npm run build        # one-shot build
npm run watch        # rebuild on change
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript type checking
npm run test         # Vitest
npm run package      # produces .vsix via vsce
```

Built with [esbuild](https://esbuild.github.io/) — produces `dist/extension.js` and `dist/mcp-server.js`.

To run locally: open this repo in Cursor, press `F5`, then open a UE project folder in the new window.

---

## 📄 License

[MIT](LICENSE) &copy; 2026 EngineLink
