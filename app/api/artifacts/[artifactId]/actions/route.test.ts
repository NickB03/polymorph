import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/artifacts/guest-token', () => ({
  getTtlMs: vi.fn().mockReturnValue(30 * 60 * 1000),
  signGuestArtifactToken: vi.fn(),
  verifyGuestArtifactToken: vi.fn(),
  verifyGuestArtifactTokenAllowExpired: vi.fn()
}))

vi.mock('@/lib/artifacts/rebuild', () => ({
  rebuildArtifactFromRevision: vi.fn()
}))

vi.mock('@/lib/artifacts/runtime', () => ({
  createE2BRuntime: vi.fn()
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: vi.fn()
}))

vi.mock('@/lib/db/actions', () => ({
  loadArtifactById: vi.fn(),
  loadArtifactRuntimeSession: vi.fn(),
  loadLatestRevisionWithSource: vi.fn(),
  upsertArtifactRuntimeSession: vi.fn()
}))

vi.mock('@/lib/utils/json-error', () => ({
  jsonError: vi.fn(
    (code: string, message: string, status: number) =>
      new Response(JSON.stringify({ code, error: message }), { status })
  )
}))

import {
  signGuestArtifactToken,
  verifyGuestArtifactToken,
  verifyGuestArtifactTokenAllowExpired
} from '@/lib/artifacts/guest-token'
import { rebuildArtifactFromRevision } from '@/lib/artifacts/rebuild'
import { createE2BRuntime } from '@/lib/artifacts/runtime'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  loadArtifactById,
  loadArtifactRuntimeSession,
  upsertArtifactRuntimeSession
} from '@/lib/db/actions'

import { POST } from './route'

function makeRequest(action: string, opts?: { guestArtifactToken?: string }) {
  return new Request('http://localhost/api/artifacts/artifact-1/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      ...(opts?.guestArtifactToken !== undefined
        ? { guestArtifactToken: opts.guestArtifactToken }
        : { guestArtifactToken: 'guest-token-123' })
    })
  })
}

const routeParams = { params: Promise.resolve({ artifactId: 'artifact-1' }) }

describe('POST /api/artifacts/[artifactId]/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue(undefined as any)
    vi.mocked(verifyGuestArtifactToken).mockResolvedValue({
      artifactId: 'artifact-1',
      runtimeSessionId: 'runtime-1',
      sandboxId: 'sandbox-1',
      chatId: 'chat-1',
      expiresAt: new Date(Date.now() + 60_000)
    })
    vi.mocked(verifyGuestArtifactTokenAllowExpired).mockResolvedValue(null)
    vi.mocked(loadArtifactById).mockResolvedValue({
      id: 'artifact-1',
      title: 'Guest App',
      status: 'ready',
      currentRevisionId: 'revision-1',
      chatId: 'chat-1'
    } as any)
    vi.mocked(loadArtifactRuntimeSession).mockResolvedValue({
      id: 'runtime-1',
      artifactId: 'artifact-1',
      sandboxId: 'sandbox-1',
      previewUrl: 'https://5173-sandbox-1.e2b.dev',
      status: 'ready',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      lastHeartbeatAt: new Date()
    } as any)
    vi.mocked(signGuestArtifactToken).mockResolvedValue('rotated-token')
    vi.mocked(createE2BRuntime).mockReturnValue({
      restartPreview: vi.fn().mockResolvedValue({
        previewUrl: 'https://5173-sandbox-1.e2b.dev',
        status: 'ready'
      })
    } as any)
    vi.mocked(upsertArtifactRuntimeSession).mockResolvedValue({
      id: 'runtime-1',
      artifactId: 'artifact-1',
      sandboxId: 'sandbox-1',
      previewUrl: 'https://5173-sandbox-1.e2b.dev',
      status: 'ready',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      lastHeartbeatAt: new Date()
    } as any)
  })

  // --- Refresh ---

  it('returns a rotated guest token on refresh', async () => {
    const res = await POST(makeRequest('refresh') as any, routeParams)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.guestArtifactToken).toBe('rotated-token')
  })

  // --- Retry ---

  it('persists runtime state and returns a rotated guest token on retry', async () => {
    const res = await POST(makeRequest('retry') as any, routeParams)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(upsertArtifactRuntimeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'runtime-1',
        artifactId: 'artifact-1',
        sandboxId: 'sandbox-1',
        status: 'ready'
      }),
      null
    )
    expect(json.guestArtifactToken).toBe('rotated-token')
  })

  // --- Rebuild ---

  it('returns 200 with new preview on successful rebuild', async () => {
    vi.mocked(rebuildArtifactFromRevision).mockResolvedValue({
      success: true,
      previewUrl: 'https://5173-new-sandbox.e2b.dev',
      sandboxId: 'new-sandbox-1',
      runtimeSessionId: 'new-runtime-1',
      status: 'ready'
    })

    const res = await POST(makeRequest('rebuild') as any, routeParams)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.previewUrl).toBe('https://5173-new-sandbox.e2b.dev')
    expect(json.status).toBe('ready')
    expect(json.guestArtifactToken).toBe('rotated-token')
    expect(rebuildArtifactFromRevision).toHaveBeenCalledWith({
      artifactId: 'artifact-1',
      userId: null
    })
  })

  it('returns 409 when rebuild is already in progress', async () => {
    vi.mocked(rebuildArtifactFromRevision).mockResolvedValue({
      success: false,
      error: 'A rebuild is already in progress for this artifact.',
      alreadyInProgress: true
    })

    const res = await POST(makeRequest('rebuild') as any, routeParams)

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.code).toBe('REBUILD_IN_PROGRESS')
  })

  it('returns 500 when rebuild fails', async () => {
    vi.mocked(rebuildArtifactFromRevision).mockResolvedValue({
      success: false,
      error: 'No source files stored for this artifact.'
    })

    const res = await POST(makeRequest('rebuild') as any, routeParams)

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.code).toBe('REBUILD_FAILED')
  })

  // --- Auth failures ---

  it('returns 401 when no userId and no guest token', async () => {
    const req = new Request(
      'http://localhost/api/artifacts/artifact-1/actions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' })
      }
    )

    const res = await POST(req as any, routeParams)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.code).toBe('AUTH_REQUIRED')
  })

  it('returns 401 when guest token is invalid', async () => {
    vi.mocked(verifyGuestArtifactToken).mockResolvedValue(null)
    vi.mocked(verifyGuestArtifactTokenAllowExpired).mockResolvedValue(null)

    const res = await POST(
      makeRequest('refresh', {
        guestArtifactToken: 'bad-token'
      }) as any,
      routeParams
    )

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.code).toBe('AUTH_REQUIRED')
  })

  // --- Expired token handling ---

  it('returns 401 with TOKEN_EXPIRED for expired token on non-rebuild action', async () => {
    vi.mocked(verifyGuestArtifactToken).mockResolvedValue(null)
    vi.mocked(verifyGuestArtifactTokenAllowExpired).mockResolvedValue({
      artifactId: 'artifact-1',
      runtimeSessionId: 'runtime-1',
      sandboxId: 'sandbox-1',
      chatId: 'chat-1',
      expiresAt: new Date(Date.now() - 60_000)
    })

    const res = await POST(
      makeRequest('refresh', {
        guestArtifactToken: 'expired-token'
      }) as any,
      routeParams
    )

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.code).toBe('TOKEN_EXPIRED')
  })

  it('accepts expired token for rebuild action', async () => {
    vi.mocked(verifyGuestArtifactToken).mockResolvedValue(null)
    vi.mocked(verifyGuestArtifactTokenAllowExpired).mockResolvedValue({
      artifactId: 'artifact-1',
      runtimeSessionId: 'runtime-1',
      sandboxId: 'sandbox-1',
      chatId: 'chat-1',
      expiresAt: new Date(Date.now() - 60_000)
    })
    vi.mocked(rebuildArtifactFromRevision).mockResolvedValue({
      success: true,
      previewUrl: 'https://5173-rebuilt.e2b.dev',
      sandboxId: 'rebuilt-sandbox',
      runtimeSessionId: 'rebuilt-runtime',
      status: 'ready'
    })

    const res = await POST(
      makeRequest('rebuild', {
        guestArtifactToken: 'expired-token'
      }) as any,
      routeParams
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.previewUrl).toBe('https://5173-rebuilt.e2b.dev')
    expect(json.guestArtifactToken).toBe('rotated-token')
  })

  // --- Invalid action ---

  it('returns 400 for unknown action', async () => {
    const req = new Request(
      'http://localhost/api/artifacts/artifact-1/actions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'explode',
          guestArtifactToken: 'guest-token-123'
        })
      }
    )

    const res = await POST(req as any, routeParams)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe('BAD_REQUEST')
  })
})
