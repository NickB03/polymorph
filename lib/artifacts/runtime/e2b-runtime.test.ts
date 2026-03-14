import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createE2BRuntime } from './e2b-runtime'
import { ArtifactRuntimeConfigError } from './types'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('E2B Runtime Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
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

  describe('request construction', () => {
    beforeEach(() => {
      vi.stubEnv('E2B_API_KEY', 'test-api-key')
    })

    it('sends correct auth headers on createSession', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sandboxID: 'sandbox-123',
          clientID: 'client-abc'
        })
      })

      const runtime = createE2BRuntime()
      await runtime.createSession({})

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]

      expect(url).toContain('/sandboxes')
      expect(options.method).toBe('POST')
      expect(options.headers).toMatchObject({
        Authorization: 'Bearer test-api-key',
        'Content-Type': 'application/json'
      })
    })

    it('uses the correct E2B API base URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sandboxID: 'sandbox-123',
          clientID: 'client-abc'
        })
      })

      const runtime = createE2BRuntime()
      await runtime.createSession({})

      const [url] = mockFetch.mock.calls[0]
      expect(url).toMatch(/^https:\/\/api\.e2b\.dev/)
    })

    it('sends sandbox template ID in createSession body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sandboxID: 'sandbox-123',
          clientID: 'client-abc'
        })
      })

      const runtime = createE2BRuntime()
      await runtime.createSession({ templateId: 'my-template' })

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.templateID).toBe('my-template')
    })

    it('returns structured result from createSession', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sandboxID: 'sandbox-456',
          clientID: 'client-xyz'
        })
      })

      const runtime = createE2BRuntime()
      const result = await runtime.createSession({})

      expect(result.sandboxId).toBe('sandbox-456')
      expect(result.sandboxUrl).toContain('sandbox-456')
    })

    it('sends auth header on destroySession', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const runtime = createE2BRuntime()
      await runtime.destroySession({ sandboxId: 'sandbox-123' })

      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toContain('sandbox-123')
      expect(options.method).toBe('DELETE')
      expect(options.headers).toMatchObject({
        Authorization: 'Bearer test-api-key'
      })
    })

    it('throws on non-OK API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key'
      })

      const runtime = createE2BRuntime()
      await expect(runtime.createSession({})).rejects.toThrow(
        /E2B API error.*401/
      )
    })
  })

  describe('file operations', () => {
    beforeEach(() => {
      vi.stubEnv('E2B_API_KEY', 'test-api-key')
    })

    it('writes files with correct endpoint and payload', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const runtime = createE2BRuntime()
      await runtime.writeFiles({
        sandboxId: 'sandbox-123',
        files: {
          'src/App.tsx': 'export default function App() { return <div /> }'
        }
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toContain('sandbox-123')
      expect(options.headers).toMatchObject({
        Authorization: 'Bearer test-api-key'
      })
    })

    it('applySourceUpdate delegates to writeFiles with same contract', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const runtime = createE2BRuntime()
      await runtime.applySourceUpdate({
        sandboxId: 'sandbox-123',
        files: { 'src/App.tsx': 'updated content' }
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('command execution', () => {
    beforeEach(() => {
      vi.stubEnv('E2B_API_KEY', 'test-api-key')
    })

    it('runs commands with correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exitCode: 0,
          stdout: 'success',
          stderr: ''
        })
      })

      const runtime = createE2BRuntime()
      const result = await runtime.runCommand({
        sandboxId: 'sandbox-123',
        command: 'npm run build'
      })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('success')

      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toContain('sandbox-123')
      expect(options.method).toBe('POST')
    })
  })

  describe('preview management', () => {
    beforeEach(() => {
      vi.stubEnv('E2B_API_KEY', 'test-api-key')
    })

    it('startPreview returns a preview URL and status', async () => {
      // startPreview runs the dev server command
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exitCode: 0,
          stdout: '',
          stderr: ''
        })
      })

      const runtime = createE2BRuntime()
      const result = await runtime.startPreview({
        sandboxId: 'sandbox-123',
        port: 5173
      })

      expect(result.previewUrl).toContain('sandbox-123')
      expect(result.previewUrl).toContain('5173')
      expect(result.status).toBe('ready')
    })

    it('restartPreview returns updated preview result', async () => {
      // Kill existing process then start again
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ exitCode: 0, stdout: '', stderr: '' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ exitCode: 0, stdout: '', stderr: '' })
        })

      const runtime = createE2BRuntime()
      const result = await runtime.restartPreview({
        sandboxId: 'sandbox-123',
        port: 5173
      })

      expect(result.previewUrl).toContain('sandbox-123')
      expect(result.status).toBe('ready')
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
