// @vitest-environment node
// Next.js server APIs (NextRequest/NextResponse) require the undici Headers
// implementation, not jsdom's, so this file opts into the node environment.
import { NextRequest } from 'next/server'

import { afterEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.hoisted(() => vi.fn())

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: mockGetUser } }))
}))

import { isPublicPath, updateSession } from './middleware'

describe('isPublicPath', () => {
  it('treats only the root route as the public root path', () => {
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/evals')).toBe(false)
    expect(isPublicPath('/search/123')).toBe(false)
  })

  it('keeps auth and share namespaces public', () => {
    expect(isPublicPath('/auth/login')).toBe(true)
    expect(isPublicPath('/share/abc')).toBe(true)
  })

  it('keeps api routes public', () => {
    expect(isPublicPath('/api/health')).toBe(true)
  })

  it('keeps metadata routes public', () => {
    expect(isPublicPath('/manifest.webmanifest')).toBe(true)
  })

  it('keeps demo assets public', () => {
    expect(isPublicPath('/demos/polymorph-demo.mp4')).toBe(true)
  })
})

function makeRequest(path: string, search = '') {
  return new NextRequest(`http://localhost${path}${search}`)
}

describe('updateSession', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('redirects unauthenticated requests on protected paths to /auth/login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const response = await updateSession(
      makeRequest('/settings', '?tab=billing')
    )

    const location = response.headers.get('location')
    expect(location).not.toBeNull()
    expect(location).toContain('/auth/login')
    // next is preserved (and URL-encoded) so the user returns after login
    expect(location).toContain('next=%2Fsettings%3Ftab%3Dbilling')
  })

  it('does not redirect unauthenticated requests on public paths', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const response = await updateSession(makeRequest('/'))

    expect(response.headers.get('location')).toBeNull()
  })

  it('does not redirect authenticated requests on protected paths', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const response = await updateSession(makeRequest('/settings'))

    expect(response.headers.get('location')).toBeNull()
  })

  it('treats a failing getUser as unauthenticated and logs the failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetUser.mockRejectedValue(new Error('supabase down'))

    const response = await updateSession(makeRequest('/settings'))

    expect(response.headers.get('location')).toContain('/auth/login')
    expect(errorSpy).toHaveBeenCalledWith(
      '[proxy] getUser failed:',
      expect.any(Error)
    )
    errorSpy.mockRestore()
  })

  it('treats a getUser timeout as unauthenticated after 5s', async () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // never resolves -> the internal 5s timeout race should reject
    mockGetUser.mockReturnValue(new Promise(() => {}))

    const pending = updateSession(makeRequest('/settings'))
    await vi.advanceTimersByTimeAsync(5000)
    const response = await pending

    expect(response.headers.get('location')).toContain('/auth/login')
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
