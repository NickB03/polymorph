import type { ArtifactStatus } from '@/lib/types/artifact'

// --- Input types ---

export interface CreateSessionInput {
  /** E2B template ID to create the sandbox from */
  templateId?: string
  /** Timeout in seconds before the sandbox auto-destroys */
  timeoutSeconds?: number
}

export interface CreateSessionResult {
  sandboxId: string
  /** Base URL for accessing files and running commands in the sandbox */
  sandboxUrl: string
}

export interface WriteFilesInput {
  sandboxId: string
  /** Map of relative file paths to file contents */
  files: Record<string, string>
}

export interface ApplySourceUpdateInput {
  sandboxId: string
  /** Map of relative file paths to new contents (app source only) */
  files: Record<string, string>
}

export interface InstallDependenciesInput {
  sandboxId: string
  /** Working directory inside the sandbox */
  cwd?: string
}

export interface StartPreviewInput {
  sandboxId: string
  /** Port the dev server listens on inside the sandbox */
  port?: number
  /** Command to start the dev server */
  startCommand?: string
}

export interface StartPreviewResult {
  previewUrl: string
  status: ArtifactStatus
}

export interface RestartPreviewInput {
  sandboxId: string
  port?: number
  startCommand?: string
}

export interface GetLogsInput {
  sandboxId: string
  /** Only return logs after this cursor/offset */
  after?: string
}

export interface RuntimeLog {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface DestroySessionInput {
  sandboxId: string
}

export interface RunCommandInput {
  sandboxId: string
  command: string
  /** Working directory */
  cwd?: string
  /** Timeout in milliseconds */
  timeoutMs?: number
}

export interface RunCommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

// --- Provider-neutral runtime interface ---

export interface ArtifactRuntime {
  /** Create a new sandbox session */
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>

  /** Write files into the sandbox filesystem */
  writeFiles(input: WriteFilesInput): Promise<void>

  /** Apply source file updates (app code only, not template-owned files) */
  applySourceUpdate(input: ApplySourceUpdateInput): Promise<void>

  /** Install dependencies inside the sandbox */
  installDependencies(input: InstallDependenciesInput): Promise<void>

  /** Run an arbitrary command inside the sandbox */
  runCommand(input: RunCommandInput): Promise<RunCommandResult>

  /** Start the dev server and return the preview URL */
  startPreview(input: StartPreviewInput): Promise<StartPreviewResult>

  /** Restart the dev server */
  restartPreview(input: RestartPreviewInput): Promise<StartPreviewResult>

  /** Retrieve build/runtime logs */
  getLogs(input: GetLogsInput): Promise<RuntimeLog[]>

  /** Destroy the sandbox session */
  destroySession(input: DestroySessionInput): Promise<void>
}

// --- Configuration error ---

export class ArtifactRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArtifactRuntimeConfigError'
  }
}
