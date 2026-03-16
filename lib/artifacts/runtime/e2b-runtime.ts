import { Sandbox } from 'e2b'

import type {
  ApplySourceUpdateInput,
  ArtifactRuntime,
  CreateSessionInput,
  CreateSessionResult,
  DestroySessionInput,
  GetLogsInput,
  InstallDependenciesInput,
  RestartPreviewInput,
  RunCommandInput,
  RunCommandResult,
  RuntimeLog,
  StartPreviewInput,
  StartPreviewResult,
  WriteFilesInput
} from './types'
import { ArtifactRuntimeConfigError } from './types'

const APP_ROOT = '/home/user/app'
const DEFAULT_SANDBOX_TIMEOUT_MS = 300_000
const DEFAULT_DEV_SERVER_PORT = 5173
const DEFAULT_DEV_SERVER_COMMAND = 'npm run dev'
const PORT_POLL_INTERVAL_MS = 500
const PORT_POLL_TIMEOUT_MS = 30_000

async function checkPortReady(
  sandbox: Sandbox,
  port: number
): Promise<boolean> {
  // Prefer curl (guaranteed in custom template via aptInstall).
  // Falls back to ss for base template compatibility.
  const result = await sandbox.commands.run(
    `curl -s -o /dev/null -w '' http://localhost:${port} 2>/dev/null || ss -tuln 2>/dev/null | grep -q :${port}`,
    { requestTimeoutMs: 5_000 }
  )
  return result.exitCode === 0
}

async function waitUntilPortReady(
  sandbox: Sandbox,
  port: number
): Promise<void> {
  const deadline = Date.now() + PORT_POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (await checkPortReady(sandbox, port)) return

    await new Promise(resolve => setTimeout(resolve, PORT_POLL_INTERVAL_MS))
  }

  // Diagnose: is the dev server process running but not listening?
  const psResult = await sandbox.commands.run(
    'ps aux | grep -i vite | grep -v grep',
    { requestTimeoutMs: 5_000 }
  )
  const diagnostic = psResult.stdout.trim()
    ? `Vite process found:\n${psResult.stdout.trim()}`
    : 'No Vite process found — the dev server may have crashed.'

  throw new Error(
    `Dev server did not start listening on port ${port} within ${PORT_POLL_TIMEOUT_MS}ms. ${diagnostic}`
  )
}

function resolveSandboxPath(filePath: string): string {
  const normalized = filePath.replace(/^\/+/, '')
  return `${APP_ROOT}/${normalized}`
}

function toWriteEntries(files: Record<string, string>) {
  return Object.entries(files).map(([filePath, content]) => ({
    path: resolveSandboxPath(filePath),
    data: content
  }))
}

/**
 * Create an E2B-backed artifact runtime.
 *
 * Fails immediately if `E2B_API_KEY` is not set.
 * Uses the official E2B SDK for sandbox operations.
 */
export function createE2BRuntime(): ArtifactRuntime {
  if (!process.env.E2B_API_KEY) {
    throw new ArtifactRuntimeConfigError(
      'E2B_API_KEY environment variable is required but not set'
    )
  }

  return {
    async createSession(
      input: CreateSessionInput
    ): Promise<CreateSessionResult> {
      const sandbox = await Sandbox.create(input.templateId || 'base', {
        timeoutMs:
          (input.timeoutSeconds || 0) * 1000 || DEFAULT_SANDBOX_TIMEOUT_MS,
        lifecycle: { onTimeout: 'pause' }
      })

      return {
        sandboxId: sandbox.sandboxId,
        sandboxUrl: `https://${sandbox.getHost(DEFAULT_DEV_SERVER_PORT)}`
      }
    },

    async writeFiles(input: WriteFilesInput): Promise<void> {
      const sandbox = await Sandbox.connect(input.sandboxId)
      await sandbox.files.write(toWriteEntries(input.files))
    },

    async applySourceUpdate(input: ApplySourceUpdateInput): Promise<void> {
      const sandbox = await Sandbox.connect(input.sandboxId)
      // Reset the timeout so actively-used sandboxes stay alive between turns
      await Sandbox.setTimeout(input.sandboxId, DEFAULT_SANDBOX_TIMEOUT_MS)
      await sandbox.files.write(toWriteEntries(input.files))
    },

    async installDependencies(input: InstallDependenciesInput): Promise<void> {
      const sandbox = await Sandbox.connect(input.sandboxId)
      const result = await sandbox.commands.run('npm install', {
        cwd: input.cwd || APP_ROOT,
        requestTimeoutMs: 120_000
      })

      if (result.exitCode !== 0) {
        const output = [result.stderr, result.stdout].filter(Boolean).join('\n')
        throw new Error(
          `npm install failed (exit ${result.exitCode}): ${output}`
        )
      }
    },

    async runCommand(input: RunCommandInput): Promise<RunCommandResult> {
      const sandbox = await Sandbox.connect(input.sandboxId)
      const result = await sandbox.commands.run(input.command, {
        cwd: input.cwd || APP_ROOT,
        ...(input.timeoutMs ? { requestTimeoutMs: input.timeoutMs } : {})
      })

      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr
      }
    },

    async startPreview(input: StartPreviewInput): Promise<StartPreviewResult> {
      const port = input.port || DEFAULT_DEV_SERVER_PORT
      const command = input.startCommand || DEFAULT_DEV_SERVER_COMMAND

      const sandbox = await Sandbox.connect(input.sandboxId)
      await Sandbox.setTimeout(input.sandboxId, DEFAULT_SANDBOX_TIMEOUT_MS)

      // With custom templates using setStartCmd, the dev server is already
      // running when the sandbox boots. Check before starting a second one.
      if (await checkPortReady(sandbox, port)) {
        return {
          previewUrl: `https://${sandbox.getHost(port)}`,
          status: 'ready'
        }
      }

      // Fallback: start the dev server (base template or restart scenario)
      await sandbox.commands.run(command, {
        cwd: APP_ROOT,
        background: true
      })

      await waitUntilPortReady(sandbox, port)

      return {
        previewUrl: `https://${sandbox.getHost(port)}`,
        status: 'ready'
      }
    },

    async restartPreview(
      input: RestartPreviewInput
    ): Promise<StartPreviewResult> {
      const port = input.port || DEFAULT_DEV_SERVER_PORT
      const command = input.startCommand || DEFAULT_DEV_SERVER_COMMAND

      const sandbox = await Sandbox.connect(input.sandboxId)
      await Sandbox.setTimeout(input.sandboxId, DEFAULT_SANDBOX_TIMEOUT_MS)

      // Kill any existing process on the dev server port
      await sandbox.commands.run(
        `kill $(lsof -t -i:${port}) 2>/dev/null || true`,
        { cwd: APP_ROOT }
      )

      // Start a fresh dev server
      await sandbox.commands.run(command, {
        cwd: APP_ROOT,
        background: true
      })

      await waitUntilPortReady(sandbox, port)

      return {
        previewUrl: `https://${sandbox.getHost(port)}`,
        status: 'ready'
      }
    },

    async getLogs(input: GetLogsInput): Promise<RuntimeLog[]> {
      // The SDK does not expose a persistent log endpoint.
      // Logs are streamed via onStdout/onStderr callbacks during command
      // execution. Return an empty array for now — the orchestration layer
      // emits structured log events via ctx.emitArtifactLog instead.
      void input
      return []
    },

    async destroySession(input: DestroySessionInput): Promise<void> {
      await Sandbox.kill(input.sandboxId)
    }
  }
}
