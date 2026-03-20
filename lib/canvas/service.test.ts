import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock DB actions
const mockCreateCanvasArtifact = vi.fn()
const mockCreateCanvasArtifactVersion = vi.fn()
const mockEnsureChatRecord = vi.fn()
const mockListCanvasArtifactVersions = vi.fn()
const mockLoadCanvasArtifactByChatId = vi.fn()
const mockLoadCanvasArtifactById = vi.fn()
const mockUpdateCanvasArtifactDiagnosticsOnly = vi.fn()
const mockUpdateCanvasArtifactDraft = vi.fn()

vi.mock('@/lib/db/actions', () => ({
  createCanvasArtifact: (...args: unknown[]) =>
    mockCreateCanvasArtifact(...args),
  createCanvasArtifactVersion: (...args: unknown[]) =>
    mockCreateCanvasArtifactVersion(...args),
  ensureChatRecord: (...args: unknown[]) => mockEnsureChatRecord(...args),
  listCanvasArtifactVersions: (...args: unknown[]) =>
    mockListCanvasArtifactVersions(...args),
  loadCanvasArtifactByChatId: (...args: unknown[]) =>
    mockLoadCanvasArtifactByChatId(...args),
  loadCanvasArtifactById: (...args: unknown[]) =>
    mockLoadCanvasArtifactById(...args),
  updateCanvasArtifactDiagnosticsOnly: (...args: unknown[]) =>
    mockUpdateCanvasArtifactDiagnosticsOnly(...args),
  updateCanvasArtifactDraft: (...args: unknown[]) =>
    mockUpdateCanvasArtifactDraft(...args)
}))

// Mock compiler
const mockCompile = vi.fn()
vi.mock('@/lib/canvas/compiler/compile-canvas-artifact', () => ({
  compileCanvasArtifact: (...args: unknown[]) => mockCompile(...args)
}))

// Mock validator (pass-through by default)
vi.mock('@/lib/canvas/validation/validate-canvas-source', () => ({
  validateCanvasSource: vi.fn(() => ({
    ok: true,
    files: ['App.tsx'],
    diagnostics: [],
    externalDependencies: []
  }))
}))

// Mock Drizzle schema references
vi.mock('@/lib/db/schema', () => ({
  canvasArtifactVersions: { id: 'id' }
}))

// Mock with-rls
vi.mock('@/lib/db/with-rls', () => ({
  withOptionalRLS: vi.fn(
    async (_userId: string | null, cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        delete: vi.fn().mockReturnValue({
          where: vi.fn()
        })
      })
  )
}))

import {
  createCanvasArtifactFromSource,
  exportCanvasArtifactHtml,
  loadCanvasArtifactState,
  recordCanvasRuntimeDiagnostics,
  restoreCanvasArtifactVersion,
  saveCanvasArtifactVersion,
  updateCanvasArtifactDraftFromSource
} from './service'

const validSource = {
  'App.tsx': 'export default function App() { return <div>Hello</div> }'
}

function makeArtifactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'art-1',
    chatId: 'chat-1',
    userId: 'user-1',
    title: 'Test',
    status: 'ready',
    draftSource: validSource,
    draftCompiledHtml: '<html></html>',
    draftDiagnostics: null,
    draftRevision: 0,
    currentVersionId: null,
    lastCompiledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

function makeVersionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ver-1',
    artifactId: 'art-1',
    versionNumber: 1,
    sourceSnapshot: validSource,
    createdBy: 'ai',
    createdAt: new Date(),
    ...overrides
  }
}

describe('Canvas Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListCanvasArtifactVersions.mockResolvedValue([])
  })

  describe('createCanvasArtifactFromSource', () => {
    it('creates artifact and compiles successfully', async () => {
      mockLoadCanvasArtifactByChatId.mockResolvedValue(null)
      mockCreateCanvasArtifact.mockResolvedValue(makeArtifactRow())
      mockCompile.mockResolvedValue({
        ok: true,
        html: '<html>compiled</html>',
        diagnostics: [],
        externalDependencies: []
      })
      mockUpdateCanvasArtifactDraft.mockResolvedValue(
        makeArtifactRow({ draftRevision: 1 })
      )
      mockCreateCanvasArtifactVersion.mockResolvedValue(makeVersionRow())
      mockLoadCanvasArtifactById.mockResolvedValue(
        makeArtifactRow({ draftRevision: 2, currentVersionId: 'ver-1' })
      )

      const result = await createCanvasArtifactFromSource({
        chatId: 'chat-1',
        userId: 'user-1',
        title: 'My App',
        draftSource: validSource
      })

      expect(result.ok).toBe(true)
      expect(result.artifact).toBeDefined()
      expect(mockCreateCanvasArtifact).toHaveBeenCalled()
      expect(mockCompile).toHaveBeenCalled()
    })

    it('returns artifact-already-exists when chat already has artifact', async () => {
      mockLoadCanvasArtifactByChatId.mockResolvedValue(makeArtifactRow())
      mockLoadCanvasArtifactById.mockResolvedValue(makeArtifactRow())

      const result = await createCanvasArtifactFromSource({
        chatId: 'chat-1',
        userId: 'user-1',
        draftSource: validSource
      })

      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('artifact-already-exists')
    })

    it('handles unique constraint violation gracefully', async () => {
      mockLoadCanvasArtifactByChatId.mockResolvedValue(null)
      mockCreateCanvasArtifact.mockRejectedValue(
        new Error('unique constraint violation')
      )

      const result = await createCanvasArtifactFromSource({
        chatId: 'chat-1',
        userId: 'user-1',
        draftSource: validSource
      })

      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('artifact-already-exists')
    })

    it('records compile failure status', async () => {
      mockLoadCanvasArtifactByChatId.mockResolvedValue(null)
      mockCreateCanvasArtifact.mockResolvedValue(makeArtifactRow())
      mockCompile.mockResolvedValue({
        ok: false,
        diagnostics: [{ severity: 'error', message: 'Syntax error' }],
        externalDependencies: []
      })
      mockUpdateCanvasArtifactDraft.mockResolvedValue(
        makeArtifactRow({ status: 'compile_failed', draftRevision: 1 })
      )
      mockLoadCanvasArtifactById.mockResolvedValue(
        makeArtifactRow({ status: 'compile_failed', draftRevision: 1 })
      )

      const result = await createCanvasArtifactFromSource({
        chatId: 'chat-1',
        userId: 'user-1',
        draftSource: validSource
      })

      expect(result.ok).toBe(false)
      // Should not create a version on compile failure
      expect(mockCreateCanvasArtifactVersion).not.toHaveBeenCalled()
    })
  })

  describe('updateCanvasArtifactDraftFromSource', () => {
    it('updates draft and compiles successfully', async () => {
      mockUpdateCanvasArtifactDraft
        .mockResolvedValueOnce(makeArtifactRow({ draftRevision: 1 }))
        .mockResolvedValueOnce(makeArtifactRow({ draftRevision: 2 }))
      mockCompile.mockResolvedValue({
        ok: true,
        html: '<html>updated</html>',
        diagnostics: [],
        externalDependencies: []
      })
      mockLoadCanvasArtifactById.mockResolvedValue(
        makeArtifactRow({ draftRevision: 2 })
      )

      const result = await updateCanvasArtifactDraftFromSource({
        artifactId: 'art-1',
        expectedRevision: 0,
        draftSource: validSource
      })

      expect(result.ok).toBe(true)
      expect(result.artifact).toBeDefined()
    })

    it('returns stale-revision when optimistic concurrency fails', async () => {
      mockUpdateCanvasArtifactDraft.mockResolvedValue(null)

      const result = await updateCanvasArtifactDraftFromSource({
        artifactId: 'art-1',
        expectedRevision: 0,
        draftSource: validSource
      })

      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('stale-revision')
    })
  })

  describe('saveCanvasArtifactVersion', () => {
    it('creates version from ready draft', async () => {
      mockLoadCanvasArtifactById.mockResolvedValue(
        makeArtifactRow({ status: 'ready' })
      )
      mockCreateCanvasArtifactVersion.mockResolvedValue(makeVersionRow())
      mockUpdateCanvasArtifactDraft.mockResolvedValue(
        makeArtifactRow({ currentVersionId: 'ver-1' })
      )

      const result = await saveCanvasArtifactVersion({
        artifactId: 'art-1',
        createdBy: 'user'
      })

      expect(result.ok).toBe(true)
    })

    it('rejects version creation when draft is not ready', async () => {
      mockLoadCanvasArtifactById.mockResolvedValue(
        makeArtifactRow({ status: 'compiling' })
      )

      const result = await saveCanvasArtifactVersion({
        artifactId: 'art-1',
        createdBy: 'user'
      })

      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('not-ready')
    })

    it('returns not-found when artifact does not exist', async () => {
      mockLoadCanvasArtifactById.mockResolvedValue(null)

      const result = await saveCanvasArtifactVersion({
        artifactId: 'nonexistent',
        createdBy: 'user'
      })

      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('not-found')
    })
  })

  describe('restoreCanvasArtifactVersion', () => {
    it('restores version and recompiles', async () => {
      mockListCanvasArtifactVersions.mockResolvedValue([makeVersionRow()])
      mockUpdateCanvasArtifactDraft
        .mockResolvedValueOnce(makeArtifactRow({ draftRevision: 1 }))
        .mockResolvedValueOnce(makeArtifactRow({ draftRevision: 2 }))
      mockCompile.mockResolvedValue({
        ok: true,
        html: '<html>restored</html>',
        diagnostics: [],
        externalDependencies: []
      })
      mockLoadCanvasArtifactById.mockResolvedValue(
        makeArtifactRow({ draftRevision: 2 })
      )

      const result = await restoreCanvasArtifactVersion({
        artifactId: 'art-1',
        versionId: 'ver-1',
        expectedRevision: 0
      })

      expect(result.ok).toBe(true)
    })

    it('returns not-found for unknown version', async () => {
      mockListCanvasArtifactVersions.mockResolvedValue([])

      const result = await restoreCanvasArtifactVersion({
        artifactId: 'art-1',
        versionId: 'nonexistent',
        expectedRevision: 0
      })

      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('not-found')
    })

    it('returns stale-revision on concurrency conflict', async () => {
      mockListCanvasArtifactVersions.mockResolvedValue([makeVersionRow()])
      mockUpdateCanvasArtifactDraft.mockResolvedValue(null)

      const result = await restoreCanvasArtifactVersion({
        artifactId: 'art-1',
        versionId: 'ver-1',
        expectedRevision: 0
      })

      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('stale-revision')
    })
  })

  describe('recordCanvasRuntimeDiagnostics', () => {
    it('persists diagnostics when revision matches', async () => {
      mockLoadCanvasArtifactById.mockResolvedValue(
        makeArtifactRow({ draftRevision: 3 })
      )
      mockUpdateCanvasArtifactDiagnosticsOnly.mockResolvedValue(
        makeArtifactRow({ draftRevision: 3 })
      )

      const result = await recordCanvasRuntimeDiagnostics({
        artifactId: 'art-1',
        draftRevision: 3,
        diagnostics: [{ severity: 'error', message: 'Runtime error' }]
      })

      expect(result.ok).toBe(true)
      expect(mockUpdateCanvasArtifactDiagnosticsOnly).toHaveBeenCalled()
      // Must NOT bump the draft revision
      expect(mockUpdateCanvasArtifactDraft).not.toHaveBeenCalled()
    })

    it('rejects diagnostics when revision does not match', async () => {
      mockLoadCanvasArtifactById.mockResolvedValue(
        makeArtifactRow({ draftRevision: 5 })
      )

      const result = await recordCanvasRuntimeDiagnostics({
        artifactId: 'art-1',
        draftRevision: 3,
        diagnostics: [{ severity: 'error', message: 'Runtime error' }]
      })

      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('stale-revision')
    })

    it('returns not-found for missing artifact', async () => {
      mockLoadCanvasArtifactById.mockResolvedValue(null)

      const result = await recordCanvasRuntimeDiagnostics({
        artifactId: 'nonexistent',
        draftRevision: 0,
        diagnostics: []
      })

      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('not-found')
    })
  })

  describe('loadCanvasArtifactState', () => {
    it('returns artifact state', async () => {
      mockLoadCanvasArtifactById.mockResolvedValue(makeArtifactRow())
      mockListCanvasArtifactVersions.mockResolvedValue([makeVersionRow()])

      const state = await loadCanvasArtifactState({ artifactId: 'art-1' })

      expect(state).not.toBeNull()
      expect(state?.artifactId).toBe('art-1')
      expect(state?.versions).toHaveLength(1)
    })

    it('returns null for missing artifact', async () => {
      mockLoadCanvasArtifactById.mockResolvedValue(null)

      const state = await loadCanvasArtifactState({
        artifactId: 'nonexistent'
      })

      expect(state).toBeNull()
    })
  })

  describe('exportCanvasArtifactHtml', () => {
    it('returns compiled HTML and metadata', async () => {
      mockLoadCanvasArtifactById.mockResolvedValue(
        makeArtifactRow({
          draftCompiledHtml: '<html>export</html>',
          draftDiagnostics: {
            validation: [],
            compile: [],
            runtime: [],
            externalDependencies: [
              { type: 'image', url: 'https://example.com/img.png' }
            ]
          }
        })
      )

      const result = await exportCanvasArtifactHtml({ artifactId: 'art-1' })

      expect(result.ok).toBe(true)
      expect(result.html).toBe('<html>export</html>')
      expect(result.hasExternalDependencies).toBe(true)
    })

    it('returns error when no compiled HTML exists', async () => {
      mockLoadCanvasArtifactById.mockResolvedValue(
        makeArtifactRow({ draftCompiledHtml: null })
      )

      const result = await exportCanvasArtifactHtml({ artifactId: 'art-1' })

      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('no-compiled-html')
    })

    it('returns not-found for missing artifact', async () => {
      mockLoadCanvasArtifactById.mockResolvedValue(null)

      const result = await exportCanvasArtifactHtml({
        artifactId: 'nonexistent'
      })

      expect(result.ok).toBe(false)
      expect(result.errorCode).toBe('not-found')
    })
  })
})
