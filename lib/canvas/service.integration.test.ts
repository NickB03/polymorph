// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@/lib/db/schema', () => ({
  canvasArtifactVersions: { id: 'id' },
  generateId: () => 'temp-id'
}))

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
  restoreCanvasArtifactVersion,
  updateCanvasArtifactDraftFromSource
} from './service'

const validCompileFailureSource = {
  'App.tsx': `
import Missing from './missing'

export default function App() {
  return <Missing />
}
  `
}

const validMissingDefaultExportSource = {
  'App.tsx': `
function App() {
  return <div>Recovered</div>
}
  `
}

const referencedUnsupportedImportSource = {
  'App.tsx': `
import { Badge } from '@acme/ui'

export default function App() {
  return <Badge />
}
  `
}

const supportedSubpathImportSource = {
  'App.tsx': `
import { enUS } from 'date-fns/locale/en-US'

export default function App() {
  return <div>{enUS.code}</div>
}
  `
}

function makeArtifactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'art-1',
    chatId: 'chat-1',
    userId: 'user-1',
    title: 'Test',
    status: 'ready',
    draftSource: validCompileFailureSource,
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
    sourceSnapshot: validCompileFailureSource,
    createdBy: 'ai',
    createdAt: new Date(),
    ...overrides
  }
}

function installStatefulDraftMocks(
  initialArtifact: ReturnType<typeof makeArtifactRow>
) {
  let artifact = initialArtifact

  mockLoadCanvasArtifactById.mockImplementation(async () => artifact)
  mockUpdateCanvasArtifactDraft.mockImplementation(async input => {
    artifact = makeArtifactRow({
      ...artifact,
      status: input.status ?? artifact.status,
      draftSource: input.draftSource ?? artifact.draftSource,
      draftCompiledHtml:
        input.draftCompiledHtml === undefined
          ? artifact.draftCompiledHtml
          : input.draftCompiledHtml,
      draftDiagnostics:
        input.draftDiagnostics === undefined
          ? artifact.draftDiagnostics
          : input.draftDiagnostics,
      currentVersionId:
        input.currentVersionId === undefined
          ? artifact.currentVersionId
          : input.currentVersionId,
      draftRevision: artifact.draftRevision + 1,
      lastCompiledAt: input.lastCompiledAt ?? artifact.lastCompiledAt
    })

    return artifact
  })

  return {
    getArtifact: () => artifact
  }
}

function expectCompileFailureResult(
  result: Awaited<
    ReturnType<
      | typeof createCanvasArtifactFromSource
      | typeof updateCanvasArtifactDraftFromSource
      | typeof restoreCanvasArtifactVersion
    >
  >,
  operation: 'create' | 'update' | 'restore',
  logSpy: ReturnType<typeof vi.spyOn>
) {
  expect(result.ok).toBe(false)
  expect(result.artifact?.status).toBe('compile_failed')

  const firstDiagnostic = result.artifact?.draftDiagnostics?.compile[0]
  expect(firstDiagnostic).toMatchObject({
    severity: 'error',
    message: expect.stringContaining('./missing')
  })

  expect(logSpy).toHaveBeenCalledTimes(1)
  expect(logSpy).toHaveBeenCalledWith('[canvas-service]', expect.any(String))

  const payload = JSON.parse(logSpy.mock.calls[0][1] as string)
  expect(payload).toMatchObject({
    operation,
    artifactId: 'art-1',
    firstDiagnostic: {
      severity: 'error',
      message: expect.stringContaining('./missing')
    }
  })
}

describe('canvas service compile integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListCanvasArtifactVersions.mockResolvedValue([])
  })

  it('preserves compile diagnostics for createCanvasArtifactFromSource failures', async () => {
    mockLoadCanvasArtifactByChatId.mockResolvedValue(null)

    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await createCanvasArtifactFromSource({
      chatId: 'chat-1',
      userId: 'user-1',
      draftSource: validCompileFailureSource
    })

    // With compile-before-persist, no artifact row is created on failure
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('compile-failed')
    expect(result.error).toContain('./missing')
    expect(result.artifact).toBeUndefined()

    // Compile failure is still logged
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledWith('[canvas-service]', expect.any(String))

    const payload = JSON.parse(logSpy.mock.calls[0][1] as string)
    expect(payload).toMatchObject({
      operation: 'create',
      firstDiagnostic: {
        severity: 'error',
        message: expect.stringContaining('./missing')
      }
    })

    // DB should NOT have been touched
    expect(mockCreateCanvasArtifact).not.toHaveBeenCalled()
  })

  it('preserves compile diagnostics for updateCanvasArtifactDraftFromSource failures', async () => {
    installStatefulDraftMocks(makeArtifactRow({ draftRevision: 1 }))

    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await updateCanvasArtifactDraftFromSource({
      artifactId: 'art-1',
      expectedRevision: 1,
      draftSource: validCompileFailureSource,
      userId: 'user-1'
    })

    expectCompileFailureResult(result, 'update', logSpy)
  })

  it('preserves compile diagnostics for restoreCanvasArtifactVersion failures', async () => {
    installStatefulDraftMocks(makeArtifactRow({ draftRevision: 2 }))
    mockListCanvasArtifactVersions.mockResolvedValue([
      makeVersionRow({ sourceSnapshot: validCompileFailureSource })
    ])

    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await restoreCanvasArtifactVersion({
      artifactId: 'art-1',
      versionId: 'ver-1',
      expectedRevision: 2,
      userId: 'user-1'
    })

    expectCompileFailureResult(result, 'restore', logSpy)
  })

  it('creates an artifact when the only issue was a missing App default export', async () => {
    mockLoadCanvasArtifactByChatId.mockResolvedValue(null)
    mockCreateCanvasArtifact.mockResolvedValue(
      makeArtifactRow({ draftSource: validMissingDefaultExportSource })
    )
    mockCreateCanvasArtifactVersion.mockResolvedValue(makeVersionRow())
    mockLoadCanvasArtifactById.mockResolvedValue(
      makeArtifactRow({ draftSource: validMissingDefaultExportSource })
    )

    const result = await createCanvasArtifactFromSource({
      chatId: 'chat-1',
      userId: 'user-1',
      draftSource: validMissingDefaultExportSource
    })

    expect(result.ok).toBe(true)
    expect(result.artifact?.status).toBe('ready')
    expect(mockCreateCanvasArtifact).toHaveBeenCalledTimes(1)
  })

  it('updates an artifact when the only issue was a missing App default export', async () => {
    installStatefulDraftMocks(
      makeArtifactRow({
        draftRevision: 1,
        draftSource: validMissingDefaultExportSource
      })
    )

    const result = await updateCanvasArtifactDraftFromSource({
      artifactId: 'art-1',
      expectedRevision: 1,
      draftSource: validMissingDefaultExportSource,
      userId: 'user-1'
    })

    expect(result.ok).toBe(true)
    expect(result.artifact?.status).toBe('ready')
  })

  it('preserves supported subpath imports through preprocessing and compilation', async () => {
    mockLoadCanvasArtifactByChatId.mockResolvedValue(null)
    mockCreateCanvasArtifact.mockResolvedValue(
      makeArtifactRow({ draftSource: supportedSubpathImportSource })
    )
    mockCreateCanvasArtifactVersion.mockResolvedValue(makeVersionRow())
    mockLoadCanvasArtifactById.mockResolvedValue(
      makeArtifactRow({ draftSource: supportedSubpathImportSource })
    )

    const result = await createCanvasArtifactFromSource({
      chatId: 'chat-1',
      userId: 'user-1',
      draftSource: supportedSubpathImportSource
    })

    expect(result.ok).toBe(true)
    expect(result.artifact?.status).toBe('ready')
    expect(mockCreateCanvasArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        draftSource: supportedSubpathImportSource
      })
    )
  })

  it('returns actionable validation errors for create when an unsupported import is still referenced', async () => {
    mockLoadCanvasArtifactByChatId.mockResolvedValue(null)

    const result = await createCanvasArtifactFromSource({
      chatId: 'chat-1',
      userId: 'user-1',
      draftSource: referencedUnsupportedImportSource
    })

    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('compile-failed')
    expect(result.error).toContain('is not allowed')
    expect(mockCreateCanvasArtifact).not.toHaveBeenCalled()
  })

  it('returns actionable validation errors for update when an unsupported import is still referenced', async () => {
    const result = await updateCanvasArtifactDraftFromSource({
      artifactId: 'art-1',
      expectedRevision: 1,
      draftSource: referencedUnsupportedImportSource,
      userId: 'user-1'
    })

    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('compile-failed')
    expect(result.error).toContain('is not allowed')
    expect(mockUpdateCanvasArtifactDraft).not.toHaveBeenCalled()
  })
})
