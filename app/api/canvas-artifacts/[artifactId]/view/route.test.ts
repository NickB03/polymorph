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
    mockVerifyGuestCanvasToken(...args)
}))

// Mock service
const mockExportHtml = vi.fn()
vi.mock('@/lib/canvas/service', () => ({
  exportCanvasArtifactHtml: (...args: unknown[]) => mockExportHtml(...args)
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

describe('GET /api/canvas-artifacts/[artifactId]/view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns inline HTML with a sandboxing CSP for authenticated user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockExportHtml.mockResolvedValue({
      ok: true,
      html: '<html>compiled</html>',
      title: 'My Dashboard',
      hasExternalDependencies: false
    })

    const req = new Request('http://localhost/api/canvas-artifacts/art-1/view')
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toBe('inline')
    expect(response.headers.get('Content-Type')).toBe(
      'text/html; charset=utf-8'
    )
    // The view URL is opened top-level (window.open in canvas-context), so the
    // document must be sandboxed via header — an opaque origin keeps
    // model-generated scripts from reading app-origin cookies and storage.
    expect(response.headers.get('Content-Security-Policy')).toBe(
      'sandbox allow-scripts'
    )
    expect(response.headers.get('Content-Security-Policy')).not.toContain(
      'allow-same-origin'
    )
    expect(response.headers.get('X-Canvas-Executes-JavaScript')).toBe('true')

    const body = await response.text()
    expect(body).toBe('<html>compiled</html>')
  })

  it('sandboxes the view served via a valid guest token', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockVerifyGuestCanvasToken.mockResolvedValue({
      chatId: 'chat-1',
      artifactId: 'art-1',
      exp: Date.now() + 60000
    })
    mockExportHtml.mockResolvedValue({
      ok: true,
      html: '<html>guest view</html>',
      title: 'Guest App',
      hasExternalDependencies: false
    })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1/view?guestCanvasToken=valid'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Security-Policy')).toBe(
      'sandbox allow-scripts'
    )
  })

  it('sandboxes the view served for artifacts attached to public chats', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockGetChat.mockResolvedValue({
      id: 'chat-1',
      userId: 'owner-1',
      visibility: 'public'
    })
    mockLoadCanvasArtifactByChatId.mockResolvedValue({ id: 'art-1' })
    mockExportHtml.mockResolvedValue({
      ok: true,
      html: '<html>public view</html>',
      title: 'Public App',
      hasExternalDependencies: false
    })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1/view?chatId=chat-1'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Security-Policy')).toBe(
      'sandbox allow-scripts'
    )
    expect(mockExportHtml).toHaveBeenCalledWith({
      artifactId: 'art-1',
      userId: 'owner-1'
    })
  })

  it('returns 404 when artifact not found', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockExportHtml.mockResolvedValue({
      ok: false,
      error: 'Artifact not found',
      errorCode: 'not-found'
    })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/nonexistent/view'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'nonexistent' })
    })

    expect(response.status).toBe(404)
  })

  it('rejects unauthenticated request without guest token', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)

    const req = new Request('http://localhost/api/canvas-artifacts/art-1/view')
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(401)
  })
})
