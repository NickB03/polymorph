import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────

const mockCreateCanvasArtifactFromSource = vi.fn()
const mockUpdateCanvasArtifactDraftFromSource = vi.fn()
const mockSaveCanvasArtifactVersion = vi.fn()
const mockLoadCanvasArtifactState = vi.fn()

vi.mock('@/lib/canvas/service', () => ({
  createCanvasArtifactFromSource: (...args: unknown[]) =>
    mockCreateCanvasArtifactFromSource(...args),
  updateCanvasArtifactDraftFromSource: (...args: unknown[]) =>
    mockUpdateCanvasArtifactDraftFromSource(...args),
  saveCanvasArtifactVersion: (...args: unknown[]) =>
    mockSaveCanvasArtifactVersion(...args),
  loadCanvasArtifactState: (...args: unknown[]) =>
    mockLoadCanvasArtifactState(...args)
}))

const mockRefreshGuestCanvasToken = vi.fn()

vi.mock('@/lib/canvas/guest-token', () => ({
  refreshGuestCanvasToken: (...args: unknown[]) =>
    mockRefreshGuestCanvasToken(...args)
}))

vi.mock('@/lib/canvas/constants', async () => {
  const actual = await vi.importActual<typeof import('@/lib/canvas/constants')>(
    '@/lib/canvas/constants'
  )
  return actual
})

vi.mock('@/lib/db/schema', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/db/schema')>('@/lib/db/schema')
  return {
    ...actual,
    generateId: () => 'art-pending'
  }
})

import type {
  CanvasEmitter,
  CanvasToolContext
} from '@/lib/canvas/tool-context'

import {
  CreateCanvasArtifactSchema,
  createCanvasArtifactTool
} from '../create-canvas-artifact'
import {
  UpdateCanvasArtifactSchema,
  updateCanvasArtifactTool
} from '../update-canvas-artifact'

// ── Helpers ──────────────────────────────────────────────────────────

function createMockEmitter(): CanvasEmitter & {
  calls: Array<{ method: string; data: unknown }>
} {
  const calls: Array<{ method: string; data: unknown }> = []
  return {
    calls,
    emitCanvasArtifact: vi.fn((data: unknown) => {
      calls.push({ method: 'emitCanvasArtifact', data })
    }),
    emitCanvasArtifactStatus: vi.fn((data: unknown) => {
      calls.push({ method: 'emitCanvasArtifactStatus', data })
    }),
    emitCanvasArtifactEvent: vi.fn((data: unknown) => {
      calls.push({ method: 'emitCanvasArtifactEvent', data })
    }),
    emitCanvasDiagnostics: vi.fn((data: unknown) => {
      calls.push({ method: 'emitCanvasDiagnostics', data })
    })
  }
}

function createCtx(
  overrides: Partial<CanvasToolContext> = {}
): CanvasToolContext & {
  emitter: ReturnType<typeof createMockEmitter>
} {
  const emitter = createMockEmitter()
  return {
    chatId: 'chat-1',
    userId: 'user-1',
    isGuest: false,
    emitter,
    ...overrides,
    ...(overrides.emitter ? {} : { emitter })
  } as CanvasToolContext & { emitter: ReturnType<typeof createMockEmitter> }
}

const READY_ARTIFACT = {
  artifactId: 'art-1',
  chatId: 'chat-1',
  title: 'Test App',
  status: 'ready' as const,
  draftRevision: 2,
  draftSource: { 'App.tsx': 'export default () => <div/>' },
  draftCompiledHtml: '<html></html>',
  draftDiagnostics: null,
  currentVersionId: 'v-1',
  versions: [
    {
      id: 'v-1',
      versionNumber: 1,
      createdBy: 'ai' as const,
      createdAt: '2026-03-19T00:00:00.000Z'
    }
  ],
  updatedAt: '2026-03-19T00:00:00.000Z'
}

const SAMPLE_FILES = { 'App.tsx': 'export default () => <div>Hello</div>' }

// ── createCanvasArtifact ─────────────────────────────────────────────

describe('createCanvasArtifactTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts a minimal file set with only App.tsx', () => {
    const result = CreateCanvasArtifactSchema.safeParse({
      title: 'Test App',
      files: SAMPLE_FILES
    })

    expect(result.success).toBe(true)
  })

  it('accepts App.tsx when the model wraps the file key in quotes', () => {
    const result = CreateCanvasArtifactSchema.safeParse({
      title: 'Test App',
      files: {
        "'App.tsx'": SAMPLE_FILES['App.tsx']
      }
    })

    expect(result.success).toBe(true)
  })

  it('emits generating status before the final result', async () => {
    const ctx = createCtx()
    mockCreateCanvasArtifactFromSource.mockResolvedValue({
      ok: true,
      artifact: READY_ARTIFACT
    })

    const toolInstance = createCanvasArtifactTool(ctx)
    await toolInstance.execute!(
      { files: SAMPLE_FILES },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(mockCreateCanvasArtifactFromSource).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'art-pending'
      })
    )
    expect(ctx.emitter.emitCanvasArtifactStatus).toHaveBeenCalledTimes(1)
  })

  it('returns conflict when chat has existing artifact', async () => {
    const ctx = createCtx()
    mockCreateCanvasArtifactFromSource.mockResolvedValue({
      ok: false,
      artifact: READY_ARTIFACT,
      error: 'This chat already has a canvas artifact',
      errorCode: 'artifact-already-exists'
    })

    const toolInstance = createCanvasArtifactTool(ctx)
    const result = await toolInstance.execute!(
      { files: SAMPLE_FILES },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(result).toMatchObject({
      artifactId: 'art-1',
      error: 'This chat already has a canvas artifact',
      errorCode: 'artifact-already-exists'
    })
  })

  it('emits artifact and final status on success', async () => {
    const ctx = createCtx()
    mockCreateCanvasArtifactFromSource.mockResolvedValue({
      ok: true,
      artifact: READY_ARTIFACT
    })

    const toolInstance = createCanvasArtifactTool(ctx)
    const result = await toolInstance.execute!(
      { title: 'My App', files: SAMPLE_FILES },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(result).toMatchObject({
      artifactId: 'art-1',
      status: 'ready',
      draftRevision: 2
    })

    // Should emit: artifact, final status
    expect(ctx.emitter.emitCanvasArtifactStatus).toHaveBeenCalledTimes(1)
    expect(ctx.emitter.emitCanvasArtifact).toHaveBeenCalledTimes(1)
  })

  it('does not emit a persisted generating status before create persistence exists', async () => {
    const ctx = createCtx()
    mockCreateCanvasArtifactFromSource.mockResolvedValue({
      ok: false,
      error: 'Compilation failed: Syntax error',
      errorCode: 'compile-failed'
    })

    const toolInstance = createCanvasArtifactTool(ctx)
    await toolInstance.execute!(
      { files: SAMPLE_FILES },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(ctx.emitter.emitCanvasArtifactStatus).not.toHaveBeenCalled()
    expect(ctx.emitter.emitCanvasArtifact).not.toHaveBeenCalled()
  })

  it('includes guestCanvasToken in status for guest flows', async () => {
    const ctx = createCtx({ isGuest: true })
    mockCreateCanvasArtifactFromSource.mockResolvedValue({
      ok: true,
      artifact: READY_ARTIFACT
    })
    mockRefreshGuestCanvasToken.mockResolvedValue('fresh-guest-token')

    const toolInstance = createCanvasArtifactTool(ctx)
    await toolInstance.execute!(
      { files: SAMPLE_FILES },
      { toolCallId: 'tc-1', messages: [] }
    )

    // The final status call should include the token
    const statusCalls = (
      ctx.emitter.emitCanvasArtifactStatus as ReturnType<typeof vi.fn>
    ).mock.calls
    const lastStatusCall = statusCalls[statusCalls.length - 1][0]
    expect(lastStatusCall.guestCanvasToken).toBe('fresh-guest-token')
    expect(mockRefreshGuestCanvasToken).toHaveBeenCalledWith({
      chatId: 'chat-1',
      artifactId: 'art-1'
    })
  })

  it('does not include guestCanvasToken for authenticated users', async () => {
    const ctx = createCtx({ isGuest: false })
    mockCreateCanvasArtifactFromSource.mockResolvedValue({
      ok: true,
      artifact: READY_ARTIFACT
    })

    const toolInstance = createCanvasArtifactTool(ctx)
    await toolInstance.execute!(
      { files: SAMPLE_FILES },
      { toolCallId: 'tc-1', messages: [] }
    )

    const statusCalls = (
      ctx.emitter.emitCanvasArtifactStatus as ReturnType<typeof vi.fn>
    ).mock.calls
    const lastStatusCall = statusCalls[statusCalls.length - 1][0]
    expect(lastStatusCall.guestCanvasToken).toBeUndefined()
    expect(mockRefreshGuestCanvasToken).not.toHaveBeenCalled()
  })
})

// ── updateCanvasArtifact ─────────────────────────────────────────────

describe('updateCanvasArtifactTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts a minimal replacement file set with only App.tsx', () => {
    const result = UpdateCanvasArtifactSchema.safeParse({
      artifactId: 'art-1',
      baseRevision: 2,
      files: SAMPLE_FILES
    })

    expect(result.success).toBe(true)
  })

  it('accepts quoted App.tsx keys for replacement file sets', () => {
    const result = UpdateCanvasArtifactSchema.safeParse({
      artifactId: 'art-1',
      baseRevision: 2,
      files: {
        "'App.tsx'": SAMPLE_FILES['App.tsx']
      }
    })

    expect(result.success).toBe(true)
  })

  it('emits generating status before final result', async () => {
    const ctx = createCtx()
    mockLoadCanvasArtifactState.mockResolvedValue(READY_ARTIFACT)
    mockUpdateCanvasArtifactDraftFromSource.mockResolvedValue({
      ok: true,
      artifact: { ...READY_ARTIFACT, draftRevision: 3 }
    })
    mockSaveCanvasArtifactVersion.mockResolvedValue({
      ok: true,
      artifact: {
        ...READY_ARTIFACT,
        draftRevision: 4,
        currentVersionId: 'v-2'
      }
    })

    const toolInstance = updateCanvasArtifactTool(ctx)
    await toolInstance.execute!(
      {
        artifactId: 'art-1',
        baseRevision: 2,
        files: SAMPLE_FILES
      },
      { toolCallId: 'tc-1', messages: [] }
    )

    const firstStatusCall = (
      ctx.emitter.emitCanvasArtifactStatus as ReturnType<typeof vi.fn>
    ).mock.calls[0][0]
    expect(firstStatusCall.status).toBe('generating')
  })

  it('loads latest draft before updating', async () => {
    const ctx = createCtx()
    mockLoadCanvasArtifactState.mockResolvedValue(READY_ARTIFACT)
    mockUpdateCanvasArtifactDraftFromSource.mockResolvedValue({
      ok: true,
      artifact: { ...READY_ARTIFACT, draftRevision: 3 }
    })
    mockSaveCanvasArtifactVersion.mockResolvedValue({
      ok: true,
      artifact: {
        ...READY_ARTIFACT,
        draftRevision: 4,
        currentVersionId: 'v-2'
      }
    })

    const toolInstance = updateCanvasArtifactTool(ctx)
    await toolInstance.execute!(
      {
        artifactId: 'art-1',
        baseRevision: 2,
        files: SAMPLE_FILES
      },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(mockLoadCanvasArtifactState).toHaveBeenCalledWith({
      artifactId: 'art-1',
      userId: 'user-1'
    })
  })

  it('returns conflict on stale revision', async () => {
    const ctx = createCtx()
    const latestArtifact = { ...READY_ARTIFACT, draftRevision: 5 }
    mockLoadCanvasArtifactState
      .mockResolvedValueOnce(READY_ARTIFACT)
      .mockResolvedValueOnce(latestArtifact)
    mockUpdateCanvasArtifactDraftFromSource.mockResolvedValue({
      ok: false,
      error: 'Draft revision is stale',
      errorCode: 'stale-revision'
    })

    const toolInstance = updateCanvasArtifactTool(ctx)
    const result = await toolInstance.execute!(
      {
        artifactId: 'art-1',
        baseRevision: 1,
        files: SAMPLE_FILES
      },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(result).toMatchObject({
      error: 'Draft revision is stale',
      errorCode: 'stale-revision',
      draftRevision: 5
    })
  })

  it('auto-creates a version on successful compile', async () => {
    const ctx = createCtx()
    mockLoadCanvasArtifactState.mockResolvedValue(READY_ARTIFACT)
    mockUpdateCanvasArtifactDraftFromSource.mockResolvedValue({
      ok: true,
      artifact: { ...READY_ARTIFACT, draftRevision: 3 }
    })
    mockSaveCanvasArtifactVersion.mockResolvedValue({
      ok: true,
      artifact: {
        ...READY_ARTIFACT,
        draftRevision: 4,
        currentVersionId: 'v-2'
      }
    })

    const toolInstance = updateCanvasArtifactTool(ctx)
    const result = await toolInstance.execute!(
      {
        artifactId: 'art-1',
        baseRevision: 2,
        files: SAMPLE_FILES
      },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(mockSaveCanvasArtifactVersion).toHaveBeenCalledWith({
      artifactId: 'art-1',
      createdBy: 'ai',
      userId: 'user-1'
    })
    expect(result).toMatchObject({
      chatId: 'chat-1',
      title: 'Test App',
      currentVersionId: 'v-2'
    })
  })

  it('returns renderable metadata for stale revision conflicts', async () => {
    const ctx = createCtx()
    const latestArtifact = { ...READY_ARTIFACT, draftRevision: 5 }
    mockLoadCanvasArtifactState
      .mockResolvedValueOnce(READY_ARTIFACT)
      .mockResolvedValueOnce(latestArtifact)
    mockUpdateCanvasArtifactDraftFromSource.mockResolvedValue({
      ok: false,
      error: 'Draft revision is stale',
      errorCode: 'stale-revision'
    })

    const toolInstance = updateCanvasArtifactTool(ctx)
    const result = await toolInstance.execute!(
      {
        artifactId: 'art-1',
        baseRevision: 1,
        files: SAMPLE_FILES
      },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(result).toMatchObject({
      artifactId: 'art-1',
      chatId: 'chat-1',
      title: 'Test App',
      status: 'ready',
      draftRevision: 5,
      errorCode: 'stale-revision'
    })
  })

  it('includes guestCanvasToken in status for guest flows', async () => {
    const ctx = createCtx({ isGuest: true })
    mockLoadCanvasArtifactState.mockResolvedValue(READY_ARTIFACT)
    mockUpdateCanvasArtifactDraftFromSource.mockResolvedValue({
      ok: true,
      artifact: { ...READY_ARTIFACT, draftRevision: 3 }
    })
    mockSaveCanvasArtifactVersion.mockResolvedValue({
      ok: true,
      artifact: {
        ...READY_ARTIFACT,
        draftRevision: 4,
        currentVersionId: 'v-2'
      }
    })
    mockRefreshGuestCanvasToken.mockResolvedValue('rotated-token')

    const toolInstance = updateCanvasArtifactTool(ctx)
    await toolInstance.execute!(
      {
        artifactId: 'art-1',
        baseRevision: 2,
        files: SAMPLE_FILES
      },
      { toolCallId: 'tc-1', messages: [] }
    )

    const statusCalls = (
      ctx.emitter.emitCanvasArtifactStatus as ReturnType<typeof vi.fn>
    ).mock.calls
    const lastStatusCall = statusCalls[statusCalls.length - 1][0]
    expect(lastStatusCall.guestCanvasToken).toBe('rotated-token')
  })

  it('returns not-found when artifact does not exist', async () => {
    const ctx = createCtx()
    mockLoadCanvasArtifactState.mockResolvedValue(null)

    const toolInstance = updateCanvasArtifactTool(ctx)
    const result = await toolInstance.execute!(
      {
        artifactId: 'art-missing',
        baseRevision: 0,
        files: SAMPLE_FILES
      },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(result).toMatchObject({
      error: 'Artifact not found',
      errorCode: 'not-found'
    })
  })

  it('emits compile_failed status when update compilation fails', async () => {
    const ctx = createCtx()
    mockLoadCanvasArtifactState.mockResolvedValue(READY_ARTIFACT)
    mockUpdateCanvasArtifactDraftFromSource.mockResolvedValue({
      ok: false,
      artifact: {
        ...READY_ARTIFACT,
        status: 'compile_failed',
        draftRevision: 3
      },
      error: 'Compilation failed: Tailwind CSS error',
      errorCode: 'compile-failed'
    })

    const toolInstance = updateCanvasArtifactTool(ctx)
    const result = await toolInstance.execute!(
      {
        artifactId: 'art-1',
        baseRevision: 2,
        files: SAMPLE_FILES
      },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(result).toMatchObject({
      status: 'compile_failed',
      errorCode: 'compile-failed'
    })
    expect(ctx.emitter.emitCanvasArtifactStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        artifactId: 'art-1',
        status: 'compile_failed'
      })
    )
  })
})
