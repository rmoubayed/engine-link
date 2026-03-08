/**
 * IPC messages between the extension host and the MCP server process.
 * These flow over the child process stdin/stdout alongside MCP protocol messages.
 */

export interface IPCStateUpdate {
  type: 'ipc:stateUpdate';
  project: {
    name: string;
    uprojectPath: string;
    projectRoot: string;
    engineAssociation: string;
    modules: Array<{ name: string; type: string; loadingPhase: string }>;
  } | null;
  engine: {
    version: string;
    root: string;
    ubtPath: string;
  } | null;
  buildTools: {
    installationPath: string;
    displayName: string;
  } | null;
  config: {
    buildConfiguration: string;
    buildTarget: string;
    platform: string;
  };
  lastBuildErrors: Array<{
    file: string;
    line: number;
    column: number;
    severity: string;
    code: string;
    message: string;
  }>;
  lastBuildResult: {
    success: boolean;
    duration: number;
    errors: number;
    warnings: number;
  } | null;
}

export interface IPCBuildRequest {
  type: 'ipc:buildRequest';
  action: 'build' | 'rebuild' | 'clean';
  configuration?: string;
  targetType?: string;
}

export interface IPCBuildResponse {
  type: 'ipc:buildResponse';
  success: boolean;
  errors: number;
  warnings: number;
  duration: number;
  errorMessages: string[];
}

export interface IPCLaunchRequest {
  type: 'ipc:launchRequest';
}

export interface IPCLiveCodingRequest {
  type: 'ipc:liveCodingRequest';
}

export interface IPCGenerateCompileCommandsRequest {
  type: 'ipc:generateCompileCommandsRequest';
}

export interface IPCGenericResponse {
  type: 'ipc:genericResponse';
  requestType: string;
  success: boolean;
  message: string;
}

export type IPCMessage =
  | IPCStateUpdate
  | IPCBuildRequest
  | IPCBuildResponse
  | IPCLaunchRequest
  | IPCLiveCodingRequest
  | IPCGenerateCompileCommandsRequest
  | IPCGenericResponse;
