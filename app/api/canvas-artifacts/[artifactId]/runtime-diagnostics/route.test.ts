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
const mockRecordDiagnostics = vi.fn()
vi.mock('@/lib/canvas/service', () => ({
  recordCanvasRuntimeDiagnostics: (...args: unknown[]) =>
    mockRecordDiagnostics(...args)
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
    draftRevision: 3,
    draftSource: { 'App.tsx': 'code' },
    draftCompiledHtml: '<html></html>',
    draftDiagnostics: {
      validation: [],
      compile: [],
      runtime: [{ severity: 'error', message: 'Runtime error' }],
      externalDependencies: []
    },
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
    `http://localhost/api/canvas-artifacts/${artifactId}/runtime-diagnostics`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )
  return [req, { params: Promise.resolve({ artifactId }) }]
}

describe('POST /api/canvas-artifacts/[artifactId]/runtime-diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckCanvasLimit.mockResolvedValue(null)
  })

  it('records diagnostics for authenticated user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockRecordDiagnostics.mockResolvedValue({
      ok: true,
      artifact: makeArtifactState()
    })

    const [req, ctx] = makeRequest({
      draftRevision: 3,
      diagnostics: [{ severity: 'error', message: 'Runtime error' }]
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(200)
  })

  it('returns 400 when draftRevision is missing', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')

    const [req, ctx] = makeRequest({
      diagnostics: [{ severity: 'error', message: 'err' }]
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(400)
  })

  it('returns 400 when diagnostics is not an array', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')

    const [req, ctx] = makeRequest({ draftRevision: 3, diagnostics: 'bad' })
    const response = await POST(req, ctx)

    expect(response.status).toBe(400)
  })

  it('returns 400 when draftRevision is not a number', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')

    const [req, ctx] = makeRequest({
      draftRevision: '3',
      diagnostics: [{ severity: 'error', message: 'err' }]
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(400)
    expect(mockRecordDiagnostics).not.toHaveBeenCalled()
  })

  it('returns 400 when diagnostics entries do not match the expected shape', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')

    const [req, ctx] = makeRequest({
      draftRevision: 3,
      diagnostics: [{ severity: 'nope', message: 42 }]
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(400)
    expect(mockRecordDiagnostics).not.toHaveBeenCalled()
  })

  it('returns 409 when revision does not match', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockRecordDiagnostics.mockResolvedValue({
      ok: false,
      error: 'Draft revision does not match',
      errorCode: 'stale-revision'
    })

    const [req, ctx] = makeRequest({
      draftRevision: 1,
      diagnostics: [{ severity: 'error', message: 'err' }]
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(409)
  })

  it('returns 404 when artifact not found', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockRecordDiagnostics.mockResolvedValue({
      ok: false,
      error: 'Artifact not found',
      errorCode: 'not-found'
    })

    const [req, ctx] = makeRequest(
      {
        draftRevision: 0,
        diagnostics: []
      },
      'nonexistent'
    )
    const response = await POST(req, ctx)

    expect(response.status).toBe(404)
  })

  it('rotates guest token on successful write', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockVerifyGuestCanvasToken.mockResolvedValue({
      chatId: 'chat-1',
      artifactId: 'art-1',
      exp: Date.now() + 60000
    })
    mockRecordDiagnostics.mockResolvedValue({
      ok: true,
      artifact: makeArtifactState()
    })
    mockRefreshGuestCanvasToken.mockResolvedValue('rotated-token')

    const [req, ctx] = makeRequest({
      draftRevision: 3,
      diagnostics: [{ severity: 'error', message: 'err' }],
      guestCanvasToken: 'original-token'
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.guestCanvasToken).toBe('rotated-token')
  })

  it('enforces rate limit', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockCheckCanvasLimit.mockResolvedValue(
      new Response(JSON.stringify({ code: 'RATE_LIMIT' }), { status: 429 })
    )

    const [req, ctx] = makeRequest({
      draftRevision: 3,
      diagnostics: []
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(429)
  })

  it('rejects without auth', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)

    const [req, ctx] = makeRequest({
      draftRevision: 3,
      diagnostics: []
    })
    const response = await POST(req, ctx)

    expect(response.status).toBe(401)
  })
})
