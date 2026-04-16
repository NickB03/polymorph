import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentUser = vi.hoisted(() => vi.fn())
const mockIsAdminUserId = vi.hoisted(() => vi.fn())
const mockWithRLS = vi.hoisted(() => vi.fn())
const mockRevalidatePath = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: mockGetCurrentUser
}))
vi.mock('@/lib/auth/is-admin', () => ({
  isAdminUserId: mockIsAdminUserId
}))
vi.mock('@/lib/db/with-rls', () => ({
  withRLS: mockWithRLS
}))
vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath
}))
vi.mock('@/lib/db/schema', () => ({
  userEvalPreferences: { userId: 'userId' }
}))

import { setPreferredEvalsLayout } from './eval-preferences'

describe('setPreferredEvalsLayout', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset()
    mockIsAdminUserId.mockReset()
    mockWithRLS.mockReset()
    mockRevalidatePath.mockReset()
  })

  it('rejects invalid layout ids', async () => {
    const result = await setPreferredEvalsLayout('zzz' as never)
    expect(result).toEqual({ success: false, error: 'Invalid layout id' })
    expect(mockWithRLS).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated callers', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const result = await setPreferredEvalsLayout('a')
    expect(result).toEqual({ success: false, error: 'Unauthenticated' })
    expect(mockWithRLS).not.toHaveBeenCalled()
  })

  it('rejects non-admin users', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-2' })
    mockIsAdminUserId.mockReturnValue(false)
    const result = await setPreferredEvalsLayout('a')
    expect(result).toEqual({ success: false, error: 'Forbidden' })
    expect(mockWithRLS).not.toHaveBeenCalled()
  })

  it('persists the preference for admin users', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mockIsAdminUserId.mockReturnValue(true)
    mockWithRLS.mockImplementation(async (_userId, cb) => {
      const fakeTx = {
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: () => Promise.resolve()
          })
        })
      }
      return cb(fakeTx as never)
    })

    const result = await setPreferredEvalsLayout('b')
    expect(result).toEqual({ success: true })
    expect(mockWithRLS).toHaveBeenCalledWith('admin-1', expect.any(Function))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/evals')
  })

  it('catches RLS / DB errors and returns a structured failure', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mockIsAdminUserId.mockReturnValue(true)
    mockWithRLS.mockRejectedValue(new Error('row-level security policy'))

    const result = await setPreferredEvalsLayout('b')
    expect(result.success).toBe(false)
    expect(result.error).toContain('row-level security policy')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
