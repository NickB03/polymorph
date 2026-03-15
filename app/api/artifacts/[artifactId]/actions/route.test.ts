import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/artifacts/guest-token', () => ({
  signGuestArtifactToken: vi.fn(),
  verifyGuestArtifactToken: vi.fn()
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
  verifyGuestArtifactToken
} from '@/lib/artifacts/guest-token'
import { createE2BRuntime } from '@/lib/artifacts/runtime'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  loadArtifactById,
  loadArtifactRuntimeSession,
  upsertArtifactRuntimeSession
} from '@/lib/db/actions'

import { POST } from './route'

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
    vi.mocked(loadArtifactById).mockResolvedValue({
      id: 'artifact-1',
      title: 'Guest App',
      status: 'ready',
      currentRevisionId: 'revision-1'
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

  it('returns a rotated guest token on refresh', async () => {
    const req = new Request(
      'http://localhost/api/artifacts/artifact-1/actions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refresh',
          guestArtifactToken: 'guest-token-123'
        })
      }
    )

    const res = await POST(req as any, {
      params: Promise.resolve({ artifactId: 'artifact-1' })
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.guestArtifactToken).toBe('rotated-token')
  })

  it('persists runtime state and returns a rotated guest token on retry', async () => {
    const req = new Request(
      'http://localhost/api/artifacts/artifact-1/actions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'retry',
          guestArtifactToken: 'guest-token-123'
        })
      }
    )

    const res = await POST(req as any, {
      params: Promise.resolve({ artifactId: 'artifact-1' })
    })

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
})
