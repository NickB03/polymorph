import { afterEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.hoisted(() => vi.fn())
const mockCreateClient = vi.hoisted(() =>
  vi.fn(async () => ({ auth: { getUser: mockGetUser } }))
)

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient
}))

import { getCurrentUser, getCurrentUserId } from './get-current-user'

describe('getCurrentUser', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns null when Supabase env vars are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    await expect(getCurrentUser()).resolves.toBeNull()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns the authenticated user when present', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    await expect(getCurrentUser()).resolves.toEqual({ id: 'user-1' })
  })

  it('returns null when Supabase reports no user', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(getCurrentUser()).resolves.toBeNull()
  })
})

describe('getCurrentUserId', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns the configured anonymous id when auth is disabled (non-cloud)', async () => {
    vi.stubEnv('ENABLE_AUTH', 'false')
    vi.stubEnv('ANONYMOUS_USER_ID', 'my-anon')
    vi.stubEnv('POLYMORPH_CLOUD_DEPLOYMENT', '')
    vi.stubEnv('VANA_CLOUD_DEPLOYMENT', '')
    await expect(getCurrentUserId()).resolves.toBe('my-anon')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('falls back to "anonymous-user" when ANONYMOUS_USER_ID is unset', async () => {
    vi.stubEnv('ENABLE_AUTH', 'false')
    vi.stubEnv('ANONYMOUS_USER_ID', '')
    vi.stubEnv('POLYMORPH_CLOUD_DEPLOYMENT', '')
    vi.stubEnv('VANA_CLOUD_DEPLOYMENT', '')
    await expect(getCurrentUserId()).resolves.toBe('anonymous-user')
  })

  it('throws when auth is disabled in a cloud deployment', async () => {
    vi.stubEnv('ENABLE_AUTH', 'false')
    vi.stubEnv('POLYMORPH_CLOUD_DEPLOYMENT', 'true')
    await expect(getCurrentUserId()).rejects.toThrow(
      'ENABLE_AUTH=false is not allowed in cloud deployment mode'
    )
  })

  it('delegates to getCurrentUser and returns the user id when auth is enabled', async () => {
    vi.stubEnv('ENABLE_AUTH', 'true')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-42' } } })
    await expect(getCurrentUserId()).resolves.toBe('user-42')
  })

  it('returns undefined when auth is enabled but there is no user', async () => {
    vi.stubEnv('ENABLE_AUTH', 'true')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(getCurrentUserId()).resolves.toBeUndefined()
  })
})
