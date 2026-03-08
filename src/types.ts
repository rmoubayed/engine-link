import * as vscode from 'vscode';

/** Represents a detected Unreal Engine installation */
export interface UEInstallation {
  version: string;
  root: string;
  source: 'registry' | 'path-scan' | 'manual' | 'uproject-association';
  ubtPath: string;
  editorPath: string;
  isSourceBuild: boolean;
}

/** Represents a detected UE project */
export interface UEProject {
  name: string;
  uprojectPath: string;
  projectRoot: string;
  engineAssociation: string;
  modules: UEProjectModule[];
}

/** Module entry from .uproject */
export interface UEProjectModule {
  name: string;
  type: string;
  loadingPhase: string;
}

/** Raw .uproject file data */
export interface UProjectData {
  fileVersion: number;
  engineAssociation: string;
  category: string;
  description: string;
  modules: UEProjectModule[];
  plugins: Array<{ name: string; enabled: boolean }>;
}

/** VS Build Tools installation info */
export interface VSBuildTools {
  installationPath: string;
  version: string;
  displayName: string;
  hasMSVC: boolean;
  hasWindowsSDK: boolean;
}

/** Build configuration types */
export type BuildConfiguration = 'Debug' | 'DebugGame' | 'Development' | 'Shipping' | 'Test';
export type BuildTargetType = 'Editor' | 'Game' | 'Client' | 'Server';
export type BuildPlatform = 'Win64' | 'Linux' | 'Mac';

/** Task definition for the enginelink task type */
export interface EngineLinkTaskDefinition extends vscode.TaskDefinition {
  type: 'enginelink';
  action: 'build' | 'rebuild' | 'clean' | 'generateCompileCommands';
  configuration?: BuildConfiguration;
  targetType?: BuildTargetType;
  platform?: BuildPlatform;
}

/** Result of running a child process */
export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** UE version profile for adaptability */
export interface UEVersionProfile {
  versionRange: string;
  ubtRelativePath: string;
  editorRelativePath: string;
  supportsGenerateClangDatabase: boolean;
  supportsLiveCoding: boolean;
  compileCommandsOutputPattern: string;
}

/** Extension-wide shared context */
export interface EngineLinkContext {
  project: UEProject | undefined;
  engine: UEInstallation | undefined;
  buildTools: VSBuildTools | undefined;
  outputChannel: vscode.OutputChannel;
  diagnosticCollection: vscode.DiagnosticCollection;
  lastBuildErrors: ParsedDiagnostic[];
  lastBuildResult: BuildResult | undefined;
}

/** Parsed build diagnostic */
export interface ParsedDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

/** Build result summary */
export interface BuildResult {
  success: boolean;
  duration: number;
  errors: number;
  warnings: number;
}
