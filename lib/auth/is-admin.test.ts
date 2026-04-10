import { afterEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentUser = vi.hoisted(() => vi.fn())
const mockGetCurrentUserId = vi.hoisted(() => vi.fn())

vi.mock('./get-current-user', () => ({
  getCurrentUser: mockGetCurrentUser,
  getCurrentUserId: mockGetCurrentUserId
}))

describe('is-admin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns false when ADMIN_USER_ID is missing', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' })
    mockGetCurrentUserId.mockResolvedValue('user-1')

    const { isCurrentUserAdmin } = await import('./is-admin')

    await expect(isCurrentUserAdmin()).resolves.toBe(false)
  })

  it('returns false when auth is disabled', async () => {
    vi.stubEnv('ADMIN_USER_ID', 'anonymous-user')
    vi.stubEnv('ENABLE_AUTH', 'false')
    mockGetCurrentUser.mockResolvedValue(null)
    mockGetCurrentUserId.mockResolvedValue('anonymous-user')

    const { isCurrentUserAdmin } = await import('./is-admin')

    await expect(isCurrentUserAdmin()).resolves.toBe(false)
  })

  it('returns false when there is no authenticated user', async () => {
    vi.stubEnv('ADMIN_USER_ID', 'user-1')
    mockGetCurrentUser.mockResolvedValue(null)
    mockGetCurrentUserId.mockResolvedValue(undefined)

    const { isCurrentUserAdmin } = await import('./is-admin')

    await expect(isCurrentUserAdmin()).resolves.toBe(false)
  })

  it('returns true only for the configured admin user id', async () => {
    vi.stubEnv('ADMIN_USER_ID', 'user-1')
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' })
    mockGetCurrentUserId.mockResolvedValue('user-1')

    const { isCurrentUserAdmin } = await import('./is-admin')

    await expect(isCurrentUserAdmin()).resolves.toBe(true)
  })
})
