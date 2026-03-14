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

const E2B_API_BASE_URL = 'https://api.e2b.dev/v1'
const DEFAULT_SANDBOX_TIMEOUT_SECONDS = 300
const DEFAULT_DEV_SERVER_PORT = 5173
const DEFAULT_DEV_SERVER_COMMAND = 'npm run dev'

function getApiKey(): string {
  const key = process.env.E2B_API_KEY
  if (!key) {
    throw new ArtifactRuntimeConfigError(
      'E2B_API_KEY environment variable is required but not set'
    )
  }
  return key
}

function getSandboxPreviewUrl(sandboxId: string, port: number): string {
  return `https://${port}-${sandboxId}.e2b.dev`
}

async function e2bFetch(
  path: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${E2B_API_BASE_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `E2B API error ${response.status} ${response.statusText}: ${body}`
    )
  }

  return response
}

function createRuntime(apiKey: string): ArtifactRuntime {
  return {
    async createSession(
      input: CreateSessionInput
    ): Promise<CreateSessionResult> {
      const response = await e2bFetch('/sandboxes', apiKey, {
        method: 'POST',
        body: JSON.stringify({
          templateID: input.templateId || 'base',
          timeout: input.timeoutSeconds || DEFAULT_SANDBOX_TIMEOUT_SECONDS
        })
      })

      const data = await response.json()
      const sandboxId = data.sandboxID

      return {
        sandboxId,
        sandboxUrl: `https://${sandboxId}.e2b.dev`
      }
    },

    async writeFiles(input: WriteFilesInput): Promise<void> {
      // Write each file to the sandbox filesystem
      for (const [filePath, content] of Object.entries(input.files)) {
        await e2bFetch(`/sandboxes/${input.sandboxId}/files`, apiKey, {
          method: 'POST',
          body: JSON.stringify({
            path: filePath,
            content
          })
        })
      }
    },

    async applySourceUpdate(input: ApplySourceUpdateInput): Promise<void> {
      // Source updates use the same file write mechanism
      for (const [filePath, content] of Object.entries(input.files)) {
        await e2bFetch(`/sandboxes/${input.sandboxId}/files`, apiKey, {
          method: 'POST',
          body: JSON.stringify({
            path: filePath,
            content
          })
        })
      }
    },

    async installDependencies(input: InstallDependenciesInput): Promise<void> {
      await e2bFetch(`/sandboxes/${input.sandboxId}/commands`, apiKey, {
        method: 'POST',
        body: JSON.stringify({
          command: 'npm install',
          cwd: input.cwd || '/home/user/app'
        })
      })
    },

    async runCommand(input: RunCommandInput): Promise<RunCommandResult> {
      const response = await e2bFetch(
        `/sandboxes/${input.sandboxId}/commands`,
        apiKey,
        {
          method: 'POST',
          body: JSON.stringify({
            command: input.command,
            cwd: input.cwd || '/home/user/app',
            timeout: input.timeoutMs
          })
        }
      )

      const data = await response.json()
      return {
        exitCode: data.exitCode ?? 0,
        stdout: data.stdout ?? '',
        stderr: data.stderr ?? ''
      }
    },

    async startPreview(input: StartPreviewInput): Promise<StartPreviewResult> {
      const port = input.port || DEFAULT_DEV_SERVER_PORT
      const command = input.startCommand || DEFAULT_DEV_SERVER_COMMAND

      await e2bFetch(`/sandboxes/${input.sandboxId}/commands`, apiKey, {
        method: 'POST',
        body: JSON.stringify({
          command,
          cwd: '/home/user/app',
          background: true
        })
      })

      return {
        previewUrl: getSandboxPreviewUrl(input.sandboxId, port),
        status: 'ready'
      }
    },

    async restartPreview(
      input: RestartPreviewInput
    ): Promise<StartPreviewResult> {
      const port = input.port || DEFAULT_DEV_SERVER_PORT
      const command = input.startCommand || DEFAULT_DEV_SERVER_COMMAND

      // Kill existing dev server process
      await e2bFetch(`/sandboxes/${input.sandboxId}/commands`, apiKey, {
        method: 'POST',
        body: JSON.stringify({
          command: `kill $(lsof -t -i:${port}) 2>/dev/null; sleep 1`,
          cwd: '/home/user/app'
        })
      })

      // Start fresh
      await e2bFetch(`/sandboxes/${input.sandboxId}/commands`, apiKey, {
        method: 'POST',
        body: JSON.stringify({
          command,
          cwd: '/home/user/app',
          background: true
        })
      })

      return {
        previewUrl: getSandboxPreviewUrl(input.sandboxId, port),
        status: 'ready'
      }
    },

    async getLogs(input: GetLogsInput): Promise<RuntimeLog[]> {
      const params = new URLSearchParams()
      if (input.after) params.set('after', input.after)

      const queryString = params.toString()
      const path = `/sandboxes/${input.sandboxId}/logs${queryString ? `?${queryString}` : ''}`

      const response = await e2bFetch(path, apiKey, { method: 'GET' })
      const data = await response.json()

      if (!Array.isArray(data)) return []

      return data.map(
        (entry: { timestamp?: string; level?: string; message?: string }) => ({
          timestamp: entry.timestamp || new Date().toISOString(),
          level: (entry.level as RuntimeLog['level']) || 'info',
          message: entry.message || ''
        })
      )
    },

    async destroySession(input: DestroySessionInput): Promise<void> {
      await e2bFetch(`/sandboxes/${input.sandboxId}`, apiKey, {
        method: 'DELETE'
      })
    }
  }
}

/**
 * Create an E2B-backed artifact runtime.
 *
 * Fails immediately if `E2B_API_KEY` is not set.
 * Uses raw HTTP requests — no E2B SDK dependency.
 */
export function createE2BRuntime(): ArtifactRuntime {
  const apiKey = getApiKey()
  return createRuntime(apiKey)
}
