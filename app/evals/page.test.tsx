import { describe, expect, it, vi } from 'vitest'

const mockRedirect = vi.hoisted(() => vi.fn())
const mockNotFound = vi.hoisted(() => vi.fn())
const mockGetCurrentUser = vi.hoisted(() => vi.fn())
const mockIsAdminUserId = vi.hoisted(() => vi.fn())
const mockGetCapabilityDashboard = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  notFound: mockNotFound
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: mockGetCurrentUser
}))

vi.mock('@/lib/auth/is-admin', () => ({
  isAdminUserId: mockIsAdminUserId
}))

vi.mock('@/lib/evals/queries', () => ({
  getCapabilityDashboard: mockGetCapabilityDashboard
}))

vi.mock('@/components/evals/dashboard', () => ({
  default: ({ data }: { data: unknown }) => <div>{JSON.stringify(data)}</div>
}))

describe('/evals page', () => {
  it('redirects logged-out users to /auth/login', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const { default: EvalsPage } = await import('./page')
    await EvalsPage()

    expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
  })

  it('hides the page from non-admin users', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-2' })
    mockIsAdminUserId.mockReturnValue(false)

    const { default: EvalsPage } = await import('./page')
    await EvalsPage()

    expect(mockNotFound).toHaveBeenCalled()
  })

  it('loads dashboard data for the admin user', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mockIsAdminUserId.mockReturnValue(true)
    mockGetCapabilityDashboard.mockResolvedValue({
      latest: null,
      previous: null,
      trend: [],
      lastUpdated: null
    })

    const { default: EvalsPage } = await import('./page')
    const result = await EvalsPage()

    expect(mockGetCapabilityDashboard).toHaveBeenCalledWith('admin-1')
    expect(result).toBeTruthy()
  })
})
