/** Extension identifier */
export const EXTENSION_ID = 'enginelink';

/** Command IDs */
export const Commands = {
  Build: `${EXTENSION_ID}.build`,
  Rebuild: `${EXTENSION_ID}.rebuild`,
  Clean: `${EXTENSION_ID}.clean`,
  LaunchEditor: `${EXTENSION_ID}.launchEditor`,
  LiveCoding: `${EXTENSION_ID}.liveCoding`,
  GenerateCompileCommands: `${EXTENSION_ID}.generateCompileCommands`,
  SelectEngine: `${EXTENSION_ID}.selectEngine`,
  SelectProject: `${EXTENSION_ID}.selectProject`,
  SelectBuildConfig: `${EXTENSION_ID}.selectBuildConfig`,
  SelectTarget: `${EXTENSION_ID}.selectTarget`,
} as const;

/** Configuration keys */
export const Config = {
  EngineRoot: `${EXTENSION_ID}.engineRoot`,
  ProjectFile: `${EXTENSION_ID}.projectFile`,
  BuildConfiguration: `${EXTENSION_ID}.buildConfiguration`,
  BuildTarget: `${EXTENSION_ID}.buildTarget`,
  Platform: `${EXTENSION_ID}.platform`,
  AutoGenerateCompileCommands: `${EXTENSION_ID}.autoGenerateCompileCommands`,
  LiveCodingMethod: `${EXTENSION_ID}.liveCoding.method`,
  VSBuildToolsPath: `${EXTENSION_ID}.vsBuildTools.path`,
} as const;

/** Context keys set via vscode.commands.executeCommand('setContext', ...) */
export const ContextKeys = {
  ProjectDetected: `${EXTENSION_ID}.projectDetected`,
  EngineFound: `${EXTENSION_ID}.engineFound`,
  BuildToolsFound: `${EXTENSION_ID}.buildToolsFound`,
  IsBuilding: `${EXTENSION_ID}.isBuilding`,
} as const;

/** UE version profiles */
export const UE_PROFILES = {
  '5.4+': {
    versionRange: '5.4+',
    ubtRelativePath: 'Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.exe',
    editorRelativePath: 'Engine/Binaries/Win64/UnrealEditor.exe',
    supportsGenerateClangDatabase: true,
    supportsLiveCoding: true,
    compileCommandsOutputPattern: '**/compile_commands.json',
  },
} as const;

/** Windows registry paths */
export const Registry = {
  LauncherInstalls: 'HKLM\\SOFTWARE\\EpicGames\\Unreal Engine',
  SourceBuilds: 'HKCU\\SOFTWARE\\Epic Games\\Unreal Engine\\Builds',
} as const;

/** Common UE installation paths to scan */
export const COMMON_ENGINE_PATHS = [
  'C:\\Program Files\\Epic Games',
  'D:\\Program Files\\Epic Games',
  'C:\\Epic Games',
  'D:\\Epic Games',
] as const;

/** Target name suffixes by target type */
export const TARGET_SUFFIXES: Record<string, string> = {
  Editor: 'Editor',
  Game: '',
  Client: 'Client',
  Server: 'Server',
};
