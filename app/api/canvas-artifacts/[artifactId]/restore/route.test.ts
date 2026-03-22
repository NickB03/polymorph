import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Next.js cookies API
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => [])
  }))
}))

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: null }, error: null })
      )
    }
  }))
}))

// Mock auth
const mockGetCurrentUserId = vi.fn()
vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: () => mockGetCurrentUserId()
}))

// Mock guest token
const mockVerifyGuestCanvasToken = vi.fn()
const mockRefreshGuestCanvasToken = vi.fn()
vi.mock('@/lib/canvas/guest-token', () => ({
  verifyGuestCanvasToken: (...args: unknown[]) =>
    mockVerifyGuestCanvasToken(...args),
  refreshGuestCanvasToken: (...args: unknown[]) =>
    mockRefreshGuestCanvasToken(...args)
}))

// Mock service
const mockRestoreVersion = vi.fn()
vi.mock('@/lib/canvas/service', () => ({
  restoreCanvasArtifactVersion: (...args: unknown[]) =>
    mockRestoreVersion(...args)
}))

// Mock rate limit
const mockCheckCanvasLimit = vi.fn()
vi.mock('@/lib/rate-limit/canvas-limits', () => ({
  checkAndEnforceCanvasLimit: (...args: unknown[]) =>
    mockCheckCanvasLimit(...args)
}))

import { POST } from './route'

function makeArtifactState(overrides: Record<string, unknown> = {}) {
  return {
    artifactId: 'art-1',
    chatId: 'chat-1',
    title: 'Test',
    status: 'ready',
    draftRevision: 2,
    draftSource: { 'App.tsx': 'code' },
    draftCompiledHtml: '<html></html>',
    draftDiagnostics: null,
    currentVersionId: null,
    versions: [],
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

function makeRequest(
  body: Record<string, unknown>,
  artifactId = 'art-1'
): [Request, { params: Promise<{ artifactId: string }> }] {
  const req = new Request(
    `http://localhost/api/canvas-artifacts/${artifactId}/restore`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )
  return [req, { params: Promise.resolve({ artifactId }) }]
}

describe('POST /api/canvas-artifacts/[artifactId]/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckCanvasLimit.mockResolvedValue(null)
  })

  it('restores version for authenticated user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockRestoreVersion.mockResolvedValue({
      ok: true,
      artifact: makeArtifactState()
    })

    const [req, ctx] = makeRequest({ versionId: 'ver-1', baseRevision: 0 })
    const response = await POST(req, ctx)

    expect(response.status).toBe(200)
  })

  it('returns 400 when versionId is missing', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')

    const [req, ctx] = makeRequest({ baseRevision: 0 })
    const response = await POST(req, ctx)

    expect(response.status).toBe(400)
  })

  it('returns 400 when baseRevision is missing', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')

    const [req, ctx] = makeRequest({ versionId: 'ver-1' })
    const response = await POST(req, ctx)

    expect(response.status).toBe(400)
  })

  it('returns 400 when versionId is empty', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')

    const [req, ctx] = makeRequest({ versionId: '', baseRevision: 0 })
    const response = await POST(req, ctx)

    expect(response.status).toBe(400)
    expect(mockRestoreVersion).not.toHaveBeenCalled()
  })

  it('returns 400 when baseRevision is not a non-negative integer', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')

    const [req, ctx] = makeRequest({
      versionId: 'ver-1',
      baseRevision: '0'
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(400)
    expect(mockRestoreVersion).not.toHaveBeenCalled()
  })

  it('returns 409 for stale revision', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockRestoreVersion.mockResolvedValue({
      ok: false,
      error: 'Draft revision is stale',
      errorCode: 'stale-revision'
    })

    const [req, ctx] = makeRequest({ versionId: 'ver-1', baseRevision: 0 })
    const response = await POST(req, ctx)

    expect(response.status).toBe(409)
  })

  it('returns 404 when version not found', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockRestoreVersion.mockResolvedValue({
      ok: false,
      error: 'Version not found',
      errorCode: 'not-found'
    })

    const [req, ctx] = makeRequest({
      versionId: 'nonexistent',
      baseRevision: 0
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(404)
  })

  it('rotates guest token on successful restore', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockVerifyGuestCanvasToken.mockResolvedValue({
      chatId: 'chat-1',
      artifactId: 'art-1',
      exp: Date.now() + 60000
    })
    mockRestoreVersion.mockResolvedValue({
      ok: true,
      artifact: makeArtifactState()
    })
    mockRefreshGuestCanvasToken.mockResolvedValue('rotated-token')

    const [req, ctx] = makeRequest({
      versionId: 'ver-1',
      baseRevision: 0,
      guestCanvasToken: 'original-token'
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.guestCanvasToken).toBe('rotated-token')
  })

  it('preserves a successful restore when guest token rotation fails', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockVerifyGuestCanvasToken.mockResolvedValue({
      chatId: 'chat-1',
      artifactId: 'art-1',
      exp: Date.now() + 60000
    })
    mockRestoreVersion.mockResolvedValue({
      ok: true,
      artifact: makeArtifactState()
    })
    mockRefreshGuestCanvasToken.mockRejectedValue(new Error('rotate failed'))

    const [req, ctx] = makeRequest({
      versionId: 'ver-1',
      baseRevision: 0,
      guestCanvasToken: 'original-token'
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.artifactId).toBe('art-1')
    expect(body.guestCanvasToken).toBeUndefined()
  })

  it('enforces rate limit', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockCheckCanvasLimit.mockResolvedValue(
      new Response(JSON.stringify({ code: 'RATE_LIMIT' }), { status: 429 })
    )

    const [req, ctx] = makeRequest({ versionId: 'ver-1', baseRevision: 0 })
    const response = await POST(req, ctx)

    expect(response.status).toBe(429)
  })
})
