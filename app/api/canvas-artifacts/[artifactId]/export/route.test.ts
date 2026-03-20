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

import { GET } from './route'

describe('GET /api/canvas-artifacts/[artifactId]/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns HTML attachment for authenticated user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockExportHtml.mockResolvedValue({
      ok: true,
      html: '<html>exported</html>',
      title: 'My Dashboard',
      hasExternalDependencies: false
    })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1/export'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain(
      'my-dashboard.html'
    )
    expect(response.headers.get('Content-Type')).toBe(
      'text/html; charset=utf-8'
    )
    expect(response.headers.get('X-Canvas-Executes-JavaScript')).toBe('true')
    expect(response.headers.get('X-Canvas-External-Dependencies')).toBe('none')

    const body = await response.text()
    expect(body).toBe('<html>exported</html>')
  })

  it('reports external dependencies in header', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockExportHtml.mockResolvedValue({
      ok: true,
      html: '<html>exported</html>',
      title: 'Test',
      hasExternalDependencies: true
    })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1/export'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.headers.get('X-Canvas-External-Dependencies')).toBe(
      'present'
    )
  })

  it('returns 404 when artifact not found', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockExportHtml.mockResolvedValue({
      ok: false,
      error: 'Artifact not found',
      errorCode: 'not-found'
    })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/nonexistent/export'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'nonexistent' })
    })

    expect(response.status).toBe(404)
  })

  it('returns 422 when no compiled HTML exists', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    mockExportHtml.mockResolvedValue({
      ok: false,
      error: 'No compiled HTML available',
      errorCode: 'no-compiled-html'
    })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1/export'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(422)
  })

  it('allows export with valid guest token', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)
    mockVerifyGuestCanvasToken.mockResolvedValue({
      chatId: 'chat-1',
      artifactId: 'art-1',
      exp: Date.now() + 60000
    })
    mockExportHtml.mockResolvedValue({
      ok: true,
      html: '<html>guest export</html>',
      title: 'Guest App',
      hasExternalDependencies: false
    })

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1/export?guestCanvasToken=valid'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(200)
  })

  it('rejects unauthenticated request without guest token', async () => {
    mockGetCurrentUserId.mockResolvedValue(undefined)

    const req = new Request(
      'http://localhost/api/canvas-artifacts/art-1/export'
    )
    const response = await GET(req, {
      params: Promise.resolve({ artifactId: 'art-1' })
    })

    expect(response.status).toBe(401)
  })
})
