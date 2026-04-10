import { afterEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentUser = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: mockGetCurrentUser
}))

import { isAdminUserId, isCurrentUserAdmin } from './is-admin'

describe('isAdminUserId', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false when ADMIN_USER_ID is not set', () => {
    expect(isAdminUserId('user-1')).toBe(false)
  })

  it('returns false for null or undefined', () => {
    vi.stubEnv('ADMIN_USER_ID', 'user-1')
    expect(isAdminUserId(null)).toBe(false)
    expect(isAdminUserId(undefined)).toBe(false)
  })

  it('returns true when userId matches ADMIN_USER_ID', () => {
    vi.stubEnv('ADMIN_USER_ID', 'user-1')
    expect(isAdminUserId('user-1')).toBe(true)
  })

  it('returns false when userId does not match', () => {
    vi.stubEnv('ADMIN_USER_ID', 'user-1')
    expect(isAdminUserId('user-2')).toBe(false)
  })
})

describe('isCurrentUserAdmin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns false when ADMIN_USER_ID is missing', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' })
    await expect(isCurrentUserAdmin()).resolves.toBe(false)
  })

  it('returns false when auth is disabled', async () => {
    vi.stubEnv('ADMIN_USER_ID', 'anonymous-user')
    vi.stubEnv('ENABLE_AUTH', 'false')
    await expect(isCurrentUserAdmin()).resolves.toBe(false)
    expect(mockGetCurrentUser).not.toHaveBeenCalled()
  })

  it('returns false when there is no authenticated user', async () => {
    vi.stubEnv('ADMIN_USER_ID', 'user-1')
    mockGetCurrentUser.mockResolvedValue(null)
    await expect(isCurrentUserAdmin()).resolves.toBe(false)
  })

  it('returns true only for the configured admin user id', async () => {
    vi.stubEnv('ADMIN_USER_ID', 'user-1')
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' })
    await expect(isCurrentUserAdmin()).resolves.toBe(true)
  })

  it('returns false when user id does not match admin', async () => {
    vi.stubEnv('ADMIN_USER_ID', 'admin-1')
    mockGetCurrentUser.mockResolvedValue({ id: 'user-2' })
    await expect(isCurrentUserAdmin()).resolves.toBe(false)
  })
})
