import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createE2BRuntime } from './e2b-runtime'
import { ArtifactRuntimeConfigError } from './types'

// Mock the e2b SDK module
vi.mock('e2b', () => {
  const mockCommandsRun = vi.fn()
  const mockFilesWrite = vi.fn()
  const mockGetHost = vi.fn((port: number) => `${port}-sandbox-mock.e2b.app`)

  const mockSandboxInstance = {
    sandboxId: 'sandbox-mock',
    commands: { run: mockCommandsRun },
    files: { write: mockFilesWrite },
    getHost: mockGetHost
  }

  return {
    Sandbox: {
      create: vi.fn().mockResolvedValue(mockSandboxInstance),
      connect: vi.fn().mockResolvedValue(mockSandboxInstance),
      kill: vi.fn().mockResolvedValue(undefined),
      setTimeout: vi.fn().mockResolvedValue(undefined)
    },
    __mockInstance: mockSandboxInstance,
    __mockCommandsRun: mockCommandsRun,
    __mockFilesWrite: mockFilesWrite,
    __mockGetHost: mockGetHost
  }
})

async function getE2BMocks() {
  const e2b = await import('e2b')
  const mocks = e2b as typeof e2b & {
    __mockInstance: {
      sandboxId: string
      commands: { run: ReturnType<typeof vi.fn> }
      files: { write: ReturnType<typeof vi.fn> }
      getHost: ReturnType<typeof vi.fn>
    }
    __mockCommandsRun: ReturnType<typeof vi.fn>
    __mockFilesWrite: ReturnType<typeof vi.fn>
    __mockGetHost: ReturnType<typeof vi.fn>
  }
  return {
    Sandbox: mocks.Sandbox,
    instance: mocks.__mockInstance,
    commandsRun: mocks.__mockCommandsRun,
    filesWrite: mocks.__mockFilesWrite,
    getHost: mocks.__mockGetHost
  }
}

describe('E2B Runtime Adapter', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()

    const { commandsRun, filesWrite, getHost } = await getE2BMocks()
    commandsRun.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
    filesWrite.mockResolvedValue(undefined)
    getHost.mockImplementation((port: number) => `${port}-sandbox-mock.e2b.app`)
  })

  describe('configuration validation', () => {
    it('throws ArtifactRuntimeConfigError when E2B_API_KEY is missing', () => {
      vi.stubEnv('E2B_API_KEY', '')

      expect(() => createE2BRuntime()).toThrow(ArtifactRuntimeConfigError)
      expect(() => createE2BRuntime()).toThrow('E2B_API_KEY')
    })

    it('creates runtime successfully when E2B_API_KEY is set', () => {
      vi.stubEnv('E2B_API_KEY', 'test-api-key')

      const runtime = createE2BRuntime()
      expect(runtime).toBeDefined()
      expect(runtime.createSession).toBeTypeOf('function')
      expect(runtime.writeFiles).toBeTypeOf('function')
      expect(runtime.applySourceUpdate).toBeTypeOf('function')
      expect(runtime.installDependencies).toBeTypeOf('function')
      expect(runtime.runCommand).toBeTypeOf('function')
      expect(runtime.startPreview).toBeTypeOf('function')
      expect(runtime.restartPreview).toBeTypeOf('function')
      expect(runtime.getLogs).toBeTypeOf('function')
      expect(runtime.destroySession).toBeTypeOf('function')
    })
  })

  describe('session lifecycle', () => {
    beforeEach(() => {
      vi.stubEnv('E2B_API_KEY', 'test-api-key')
    })

    it('creates a session with the specified template', async () => {
      const { Sandbox, instance, getHost } = await getE2BMocks()
      instance.sandboxId = 'sandbox-456'
      getHost.mockImplementation(
        (port: number) => `${port}-sandbox-456.e2b.app`
      )

      const runtime = createE2BRuntime()
      const result = await runtime.createSession({ templateId: 'my-template' })

      expect(Sandbox.create).toHaveBeenCalledWith('my-template', {
        timeoutMs: 300_000,
        lifecycle: { onTimeout: 'pause' }
      })
      expect(result.sandboxId).toBe('sandbox-456')
      expect(result.sandboxUrl).toContain('sandbox-456')
    })

    it('uses base template when templateId is not specified', async () => {
      const { Sandbox } = await getE2BMocks()

      const runtime = createE2BRuntime()
      await runtime.createSession({})

      expect(Sandbox.create).toHaveBeenCalledWith('base', {
        timeoutMs: 300_000,
        lifecycle: { onTimeout: 'pause' }
      })
    })

    it('converts timeoutSeconds to timeoutMs', async () => {
      const { Sandbox } = await getE2BMocks()

      const runtime = createE2BRuntime()
      await runtime.createSession({ timeoutSeconds: 60 })

      expect(Sandbox.create).toHaveBeenCalledWith('base', {
        timeoutMs: 60_000,
        lifecycle: { onTimeout: 'pause' }
      })
    })

    it('destroys a session via Sandbox.kill', async () => {
      const { Sandbox } = await getE2BMocks()

      const runtime = createE2BRuntime()
      await runtime.destroySession({ sandboxId: 'sandbox-123' })

      expect(Sandbox.kill).toHaveBeenCalledWith('sandbox-123')
    })
  })

  describe('file operations', () => {
    beforeEach(() => {
      vi.stubEnv('E2B_API_KEY', 'test-api-key')
    })

    it('writes files with resolved sandbox paths', async () => {
      const { Sandbox, filesWrite } = await getE2BMocks()

      const runtime = createE2BRuntime()
      await runtime.writeFiles({
        sandboxId: 'sandbox-123',
        files: {
          'src/App.tsx': 'export default function App() { return <div /> }'
        }
      })

      expect(Sandbox.connect).toHaveBeenCalledWith('sandbox-123')
      expect(filesWrite).toHaveBeenCalledWith([
        {
          path: '/home/user/app/src/App.tsx',
          data: 'export default function App() { return <div /> }'
        }
      ])
    })

    it('applySourceUpdate delegates to files.write with same contract', async () => {
      const { Sandbox, filesWrite } = await getE2BMocks()

      const runtime = createE2BRuntime()
      await runtime.applySourceUpdate({
        sandboxId: 'sandbox-123',
        files: { 'src/App.tsx': 'updated content' }
      })

      expect(filesWrite).toHaveBeenCalledWith([
        {
          path: '/home/user/app/src/App.tsx',
          data: 'updated content'
        }
      ])
      expect(Sandbox.setTimeout).toHaveBeenCalledWith('sandbox-123', 300_000)
    })
  })

  describe('command execution', () => {
    beforeEach(() => {
      vi.stubEnv('E2B_API_KEY', 'test-api-key')
    })

    it('runs commands and returns the result', async () => {
      const { commandsRun } = await getE2BMocks()
      commandsRun.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'success',
        stderr: ''
      })

      const runtime = createE2BRuntime()
      const result = await runtime.runCommand({
        sandboxId: 'sandbox-123',
        command: 'npm run build'
      })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('success')
      expect(commandsRun).toHaveBeenCalledWith('npm run build', {
        cwd: '/home/user/app'
      })
    })

    it('installs dependencies and throws on failure', async () => {
      const { commandsRun } = await getE2BMocks()
      commandsRun.mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'ERESOLVE unable to resolve'
      })

      const runtime = createE2BRuntime()
      await expect(
        runtime.installDependencies({ sandboxId: 'sandbox-123' })
      ).rejects.toThrow(/npm install failed/)
    })

    it('includes both stdout and stderr in install failure message', async () => {
      const { commandsRun } = await getE2BMocks()
      commandsRun.mockResolvedValueOnce({
        exitCode: 1,
        stdout: 'npm warn deprecated',
        stderr: 'ERR! peer dep'
      })

      const runtime = createE2BRuntime()
      await expect(
        runtime.installDependencies({ sandboxId: 'sandbox-123' })
      ).rejects.toThrow(/npm warn deprecated/)
    })
  })

  describe('preview management', () => {
    beforeEach(() => {
      vi.stubEnv('E2B_API_KEY', 'test-api-key')
    })

    it('startPreview returns immediately when port is already listening (custom template)', async () => {
      const { Sandbox, commandsRun } = await getE2BMocks()

      // Pre-running server check succeeds immediately
      commandsRun.mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: ''
      })

      const runtime = createE2BRuntime()
      const result = await runtime.startPreview({
        sandboxId: 'sandbox-123',
        port: 5173
      })

      expect(result.previewUrl).toContain('5173')
      expect(result.status).toBe('ready')
      // Only the initial port check — no dev server start needed
      expect(commandsRun).toHaveBeenCalledTimes(1)
      expect(commandsRun).toHaveBeenCalledWith(
        expect.stringContaining('curl'),
        { requestTimeoutMs: 5_000 }
      )
      expect(Sandbox.setTimeout).toHaveBeenCalledWith('sandbox-123', 300_000)
    })

    it('startPreview falls back to starting dev server when port is not listening', async () => {
      const { commandsRun } = await getE2BMocks()

      commandsRun
        // Initial port check: not listening
        .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' })
        // Dev server start (background)
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
        // Port poll: ready
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })

      const runtime = createE2BRuntime()
      const result = await runtime.startPreview({
        sandboxId: 'sandbox-123',
        port: 5173
      })

      expect(result.previewUrl).toContain('5173')
      expect(result.status).toBe('ready')
      expect(commandsRun).toHaveBeenCalledTimes(3)
      expect(commandsRun).toHaveBeenNthCalledWith(2, 'npm run dev', {
        cwd: '/home/user/app',
        background: true
      })
    })

    it('startPreview retries port check until ready', async () => {
      const { commandsRun } = await getE2BMocks()

      commandsRun
        // Initial port check: not listening
        .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' })
        // Dev server start
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
        // Port not ready yet
        .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' })
        // Port ready
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })

      const runtime = createE2BRuntime()
      const result = await runtime.startPreview({
        sandboxId: 'sandbox-123',
        port: 5173
      })

      expect(result.status).toBe('ready')
      expect(commandsRun).toHaveBeenCalledTimes(4)
    })

    it('restartPreview kills existing process, starts new one, and polls port', async () => {
      const { Sandbox, commandsRun } = await getE2BMocks()

      // Kill, start, port check
      commandsRun
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })

      const runtime = createE2BRuntime()
      const result = await runtime.restartPreview({
        sandboxId: 'sandbox-123',
        port: 5173
      })

      expect(result.previewUrl).toContain('5173')
      expect(result.status).toBe('ready')
      expect(commandsRun).toHaveBeenCalledTimes(3)
      expect(Sandbox.setTimeout).toHaveBeenCalledWith('sandbox-123', 300_000)
    })
  })

  describe('runtime bootstrap validation', () => {
    it('throws ArtifactRuntimeConfigError (not generic Error) when E2B_API_KEY is unset', () => {
      vi.stubEnv('E2B_API_KEY', '')

      try {
        createE2BRuntime()
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ArtifactRuntimeConfigError)
        expect((err as ArtifactRuntimeConfigError).name).toBe(
          'ArtifactRuntimeConfigError'
        )
        expect((err as ArtifactRuntimeConfigError).message).toContain(
          'E2B_API_KEY'
        )
      }
    })

    it('throws ArtifactRuntimeConfigError when E2B_API_KEY is undefined', () => {
      vi.stubEnv('E2B_API_KEY', undefined)

      expect(() => createE2BRuntime()).toThrow(ArtifactRuntimeConfigError)
    })

    it('does not throw when E2B_API_KEY has a non-empty value', () => {
      vi.stubEnv('E2B_API_KEY', 'sk-valid-key')

      expect(() => createE2BRuntime()).not.toThrow()
    })

    it('validates config eagerly at construction time, not lazily at first call', () => {
      vi.stubEnv('E2B_API_KEY', '')

      // The error happens at createE2BRuntime(), not at runtime.createSession()
      expect(() => createE2BRuntime()).toThrow(ArtifactRuntimeConfigError)
    })
  })

  describe('module boundary', () => {
    it('does not export E2B-specific types from the public API', async () => {
      const indexModule = await import('./index')
      const exportedNames = Object.keys(indexModule)

      // Should export the factory and type re-exports, never E2B-specific internals
      expect(exportedNames).toContain('createE2BRuntime')
      expect(exportedNames).not.toContain('E2B_API_BASE_URL')
      expect(exportedNames).not.toContain('e2bFetch')
    })

    it('ArtifactRuntime interface is satisfied by the created runtime', () => {
      vi.stubEnv('E2B_API_KEY', 'test-api-key')

      const runtime = createE2BRuntime()

      // Verify all interface methods exist
      const requiredMethods = [
        'createSession',
        'writeFiles',
        'applySourceUpdate',
        'installDependencies',
        'runCommand',
        'startPreview',
        'restartPreview',
        'getLogs',
        'destroySession'
      ] as const

      for (const method of requiredMethods) {
        expect(runtime[method]).toBeTypeOf('function')
      }
    })
  })
})
