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
vi.mock('@/lib/canvas/guest-token', () => ({
  verifyGuestCanvasToken: (...args: unknown[]) =>
    mockVerifyGuestCanvasToken(...args),
  refreshGuestCanvasToken: vi.fn(() => Promise.resolve('new-token'))
}))

// Mock service
const mockLoadCanvasArtifactState = vi.fn()
vi.mock('@/lib/canvas/service', () => ({
  loadCanvasArtifactState: (...args: unknown[]) =>
    mockLoadCanvasArtifactState(...args)
}))

// Mock db actions
const mockGetChat = vi.fn()
const mockLoadCanvasArtifactByChatId = vi.fn()
vi.mock('@/lib/db/actions', () => ({
  getChat: (...args: unknown[]) => mockGetChat(...args),
  loadCanvasArtifactByChatId: (...args: unknown[]) =>
    mockLoadCanvasArtifactByChatId(...args)
}))

import { GET } from './route'

function makeArtifactState(overrides: Record<string, unknown> = {}) {
  return {
    artifactId: 'art-1',
    chatId: 'chat-1',
    title: 'Test',
    status: 'ready',
    draftRevision: 0,
    draftSource: { 'App.tsx': 'code' },
    draftCompiledHtml: '<html></html>',
    draftDiagnostics: null,
    currentVersionId: null,
    versions: [],
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

describe('GET /api/canvas-artifacts/[artifactId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns artifact state for authenticated user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockLoadCanvasArtifactState.mockResolvedValue(makeArtifactState())

    const req = new Request('http://localhost/api/canvas-artifacts/art-1')
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.artifactId).toBe('art-1')
  })

  it('returns artifact state for valid guest token', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockVerifyGuestCanvasToken.mockResolvedValue({
      chatId: 'chat-1',
      artifactId: 'art-1',
      exp: Date.now() + 60000
    })
    mockLoadCanvasArtifactState.mockResolvedValue(makeArtifactState())

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1?guestCanvasToken=valid-token'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(200)
    expect(mockVerifyGuestCanvasToken).toHaveBeenCalledTimes(1)
  })

  it('rejects unauthenticated request without guest token', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)

    const req = new Request('http://localhost/api/canvas-artifacts/art-1')
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(401)
  })

  it('returns artifact state for anonymous viewers of a public chat', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockGetChat.mockResolvedValue({
      id: 'chat-1',
      userId: 'owner-1',
      visibility: 'public'
    })
    mockLoadCanvasArtifactByChatId.mockResolvedValue({ id: 'art-1' })
    mockLoadCanvasArtifactState.mockResolvedValue(makeArtifactState())

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1?chatId=chat-1'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(200)
    expect(mockGetChat).toHaveBeenCalledWith('chat-1', undefined)
    expect(mockLoadCanvasArtifactByChatId).toHaveBeenCalledWith(
      'chat-1',
      'owner-1'
    )
    expect(mockLoadCanvasArtifactState).toHaveBeenCalledWith({
      artifactId: 'art-1',
      userId: 'owner-1'
    })
  })

  it('returns artifact state for logged-in non-owners of a public chat', async () => {
    mockGetCurrentUserId.mockResolvedValue('viewer-1')
    mockLoadCanvasArtifactState
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeArtifactState())
    mockGetChat.mockResolvedValue({
      id: 'chat-1',
      userId: 'owner-1',
      visibility: 'public'
    })
    mockLoadCanvasArtifactByChatId.mockResolvedValue({ id: 'art-1' })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1?chatId=chat-1'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(200)
    expect(mockLoadCanvasArtifactState).toHaveBeenNthCalledWith(1, {
      artifactId: 'art-1',
      userId: 'viewer-1'
    })
    expect(mockGetChat).toHaveBeenCalledWith('chat-1', 'viewer-1')
    expect(mockLoadCanvasArtifactState).toHaveBeenNthCalledWith(2, {
      artifactId: 'art-1',
      userId: 'owner-1'
    })
  })

  it('rejects public chat access when the artifact does not belong to that chat', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockGetChat.mockResolvedValue({
      id: 'chat-1',
      userId: 'owner-1',
      visibility: 'public'
    })
    mockLoadCanvasArtifactByChatId.mockResolvedValue({ id: 'other-artifact' })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1?chatId=chat-1'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(404)
    expect(mockLoadCanvasArtifactState).not.toHaveBeenCalled()
  })

  it('rejects public chat access for private chats', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockGetChat.mockResolvedValue({
      id: 'chat-1',
      userId: 'owner-1',
      visibility: 'private'
    })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1?chatId=chat-1'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(404)
    expect(mockLoadCanvasArtifactByChatId).not.toHaveBeenCalled()
    expect(mockLoadCanvasArtifactState).not.toHaveBeenCalled()
  })

  it('rejects expired guest token', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockVerifyGuestCanvasToken.mockResolvedValue(null)

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1?guestCanvasToken=expired'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(403)
  })

  it('rejects guest token with mismatched artifactId', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockVerifyGuestCanvasToken.mockResolvedValue({
      chatId: 'chat-1',
      artifactId: 'other-artifact',
      exp: Date.now() + 60000
    })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1?guestCanvasToken=mismatched'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(403)
  })

  it('rejects guest token when the verified chatId does not match the loaded artifact', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockVerifyGuestCanvasToken.mockResolvedValue({
      chatId: 'chat-other',
      artifactId: 'art-1',
      exp: Date.now() + 60000
    })
    mockLoadCanvasArtifactState.mockResolvedValue(makeArtifactState())

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1?guestCanvasToken=valid-token'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(403)
  })

  it('returns 404 when artifact not found', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockLoadCanvasArtifactState.mockResolvedValue(null)

    const req = new Request('http://localhost/api/canvas-artifacts/nonexistent')
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'nonexistent' })
    })

    expect(response.status).toBe(404)
  })
})
