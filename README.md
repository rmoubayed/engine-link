# EngineLink

Cursor-first Unreal Engine build bridge. Build, launch, and live-code UE projects with AI-powered tooling.

EngineLink connects Cursor to Unreal Engine's build system so you don't need Rider. Cursor handles code intelligence — EngineLink handles everything else: builds, launch, live coding, and compile database generation. It also teaches Cursor's AI about UE conventions via auto-generated rules and exposes build tools as MCP tools the AI agent can call directly.

## Requirements

- **Cursor** (or VS Code 1.85+)
- **Unreal Engine 5.4+**
- **Visual Studio Build Tools 2022** (with "Desktop development with C++" workload)
- **Node.js** (for the MCP server)
- **Windows** (macOS/Linux support planned)

## Features

| Feature | Description |
|---|---|
| Auto-detect UE projects | Scans workspace for `.uproject` files on open |
| Engine discovery | Finds UE installs from Windows Registry + common paths |
| Build / Rebuild / Clean | Invokes UnrealBuildTool with correct target, config, and platform |
| Launch Unreal Editor | Opens the editor for your project from Cursor |
| Live Coding | Triggers Ctrl+Alt+F11 to hot-reload C++ without full rebuild |
| compile_commands.json | Auto-generates so Cursor's C++ IntelliSense works with UE |
| Sidebar panel | Rider-inspired panel with config dropdowns, action buttons, build status |
| Cursor AI rules | Auto-generates `.cursor/rules/` files that teach the AI about UE conventions |
| MCP server | Exposes 8 tools so Cursor's AI agent can build, diagnose errors, launch editor, etc. |

## Local Development & Testing

### 1. Clone and install

```bash
git clone https://github.com/enginelink/enginelink.git
cd enginelink
npm install
```

### 2. Build

```bash
npm run build        # one-time build
npm run watch        # rebuild on file changes
```

This produces:
- `dist/extension.js` — the extension bundle
- `dist/mcp-server.js` — the MCP server bundle

### 3. Run in Cursor/VS Code (Extension Development Host)

**Option A: Using the debugger**

1. Open the `Gamify` folder in Cursor (or VS Code)
2. Press `F5` (or Run > Start Debugging)
3. This launches a new Cursor/VS Code window (the "Extension Development Host") with EngineLink loaded
4. In that new window, open a folder containing a `.uproject` file
5. EngineLink will activate and detect your project

**Option B: Manual VSIX install**

```bash
npm run package      # creates enginelink-0.1.0.vsix
```

Then in Cursor: `Ctrl+Shift+P` > "Extensions: Install from VSIX..." > select the `.vsix` file.

### 4. Verify it works

Once you open a UE project folder in the Extension Development Host:

1. **Check the Output panel** — Select "EngineLink" from the dropdown. You should see:
   ```
   [EngineLink] Activating...
   [EngineLink] Scanning for UE projects...
   [EngineLink] Project: YourProject (5.4)
   [EngineLink] Discovering UE installations...
   [EngineLink] Found N engine(s).
   [EngineLink] Engine: UE 5.4 at C:\...
   [EngineLink] Detecting VS Build Tools...
   [EngineLink] Build Tools: Visual Studio ... at C:\...
   [EngineLink] Cursor rules generated in .cursor/rules/
   [EngineLink] Activated successfully.
   ```

2. **Check the sidebar** — Click the EngineLink icon in the activity bar (left side). You should see the panel with your project name, engine version, build config, and action buttons.

3. **Check the status bar** — Bottom left should show your project name, engine version, and build tools.

4. **Run a build** — Either:
   - Click "Build" in the sidebar
   - `Ctrl+Shift+P` > "EngineLink: Build"
   - `Ctrl+Shift+B` (when a UE project is detected)

5. **Check error parsing** — If the build has errors, they appear in the Problems panel (`Ctrl+Shift+M`).

6. **Check Cursor rules** — Look in your UE project folder for `.cursor/rules/`. Should contain 5 `.mdc` files.

7. **Check MCP registration** — Look for `.cursor/mcp.json` in your project folder. It should contain the `enginelink` server entry.

### 5. Type checking

```bash
npm run typecheck    # runs tsc --noEmit
```

### 6. Project structure

```
src/
  extension.ts           # Entry point
  constants.ts           # Command IDs, config keys
  types.ts               # Shared TypeScript interfaces
  detection/             # UE project, engine, build tools detection
  build/                 # UBT command builder, task provider
  commands/              # Command handlers (build, launch, live coding, etc.)
  ui/                    # Sidebar WebView, status bar, output channel
  cursor/                # Cursor AI rules generator + MCP server lifecycle
  mcp/                   # MCP server (standalone process)
  parsers/               # .uproject parser, MSVC error parser
  platform/              # Windows registry, process spawning, path utils
  config/                # Settings wrapper
```

## Commands

All commands are available via `Ctrl+Shift+P` with the "EngineLink:" prefix:

| Command | Keybinding | Description |
|---|---|---|
| Build | `Ctrl+Shift+B` | Build the project |
| Rebuild | — | Clean + Build |
| Clean | — | Clean build artifacts |
| Launch Unreal Editor | — | Open the editor for your project |
| Live Coding Compile | `Ctrl+Alt+F11` | Trigger live coding (editor must be running) |
| Generate compile_commands.json | — | Regenerate compile database |
| Select Engine | — | Pick a UE installation |
| Select Project | — | Pick a .uproject file |
| Select Build Configuration | — | Pick Debug/Development/Shipping/etc. |

## Settings

All settings are under the `enginelink` namespace in Cursor/VS Code settings:

| Setting | Default | Description |
|---|---|---|
| `enginelink.engineRoot` | `""` | Manual UE engine root path (auto-detects if empty) |
| `enginelink.projectFile` | `""` | Manual .uproject path (auto-detects if empty) |
| `enginelink.buildConfiguration` | `Development` | Debug, DebugGame, Development, Shipping, Test |
| `enginelink.buildTarget` | `Editor` | Editor, Game, Client, Server |
| `enginelink.platform` | `Win64` | Target platform |
| `enginelink.autoGenerateCompileCommands` | `true` | Auto-generate compile_commands.json on activation |
| `enginelink.liveCoding.method` | `keystroke` | Live coding method (keystroke or disabled) |
| `enginelink.vsBuildTools.path` | `""` | Manual VS Build Tools path (auto-detects if empty) |

## MCP Tools (for Cursor AI)

When EngineLink is active, Cursor's AI agent can call these tools:

| Tool | What it does |
|---|---|
| `enginelink_build` | Trigger a build (with optional config/target override) |
| `enginelink_clean` | Clean build artifacts |
| `enginelink_rebuild` | Clean + build |
| `enginelink_get_build_errors` | Get current build errors for AI diagnosis |
| `enginelink_get_project_info` | Get project name, engine, modules, config |
| `enginelink_launch_editor` | Launch Unreal Editor |
| `enginelink_live_coding` | Trigger live coding compile |
| `enginelink_generate_compile_commands` | Regenerate compile_commands.json |

Example: Tell Cursor *"fix this build error"* and the AI can call `enginelink_get_build_errors`, read the MSVC output, fix the code, then call `enginelink_build` to verify.

## Troubleshooting

**"No .uproject files found"**
- Make sure you opened the folder containing your `.uproject` file (not a parent or subfolder)

**"No Unreal Engine installations found"**
- Set `enginelink.engineRoot` in settings to your UE install path (e.g., `C:\Program Files\Epic Games\UE_5.4`)

**"VS Build Tools not found"**
- Install Visual Studio Build Tools 2022 with the "Desktop development with C++" workload
- Or set `enginelink.vsBuildTools.path` to your VS install path

**Build errors not showing in Problems panel**
- The MSVC problem matcher expects standard compiler output format. If using a custom build setup, errors may not parse correctly.

**Live Coding not working**
- Unreal Editor must be running
- Live Coding must be enabled in Editor Preferences > Live Coding

## License

MIT
