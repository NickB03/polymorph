import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

describe('getPrivilegedDb', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgres://owner:pass@localhost:5432/polymorph',
      NODE_ENV: 'test'
    }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.unmock('postgres')
    vi.unmock('drizzle-orm/postgres-js')
  })

  it('rejects connections that resolve to the restricted app_user role', async () => {
    const mockExecute = vi
      .fn()
      .mockResolvedValue([{ current_user: 'app_user' }])
    const mockDb = { execute: mockExecute }

    vi.doMock('postgres', () => ({
      default: vi.fn(() => ({ mockClient: true }))
    }))

    vi.doMock('drizzle-orm/postgres-js', () => ({
      drizzle: vi.fn(() => mockDb)
    }))

    const { getPrivilegedDb } = await import('../admin')

    await expect(getPrivilegedDb()).rejects.toThrow(/app_user/)
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })
})
