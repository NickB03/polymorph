import { describe, expect, it, vi } from 'vitest'

const mockRedirect = vi.hoisted(() => vi.fn())
const mockNotFound = vi.hoisted(() => vi.fn())
const mockGetCurrentUser = vi.hoisted(() => vi.fn())
const mockIsAdminUserId = vi.hoisted(() => vi.fn())
const mockGetEvalsDashboard = vi.hoisted(() => vi.fn())
const mockGetPreferredEvalsLayout = vi.hoisted(() => vi.fn())

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
  getEvalsDashboard: mockGetEvalsDashboard,
  getPreferredEvalsLayout: mockGetPreferredEvalsLayout
}))

vi.mock('@/components/evals/dashboard-v2/dashboard', () => ({
  EvalsDashboardV2: ({
    data,
    initialLayout
  }: {
    data: unknown
    initialLayout: string
  }) => (
    <div data-testid="dashboard-v2" data-layout={initialLayout}>
      {JSON.stringify(data)}
    </div>
  )
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

  it('loads dashboard data and preferred layout in parallel for admin users', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mockIsAdminUserId.mockReturnValue(true)
    mockGetEvalsDashboard.mockResolvedValue({
      capability: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      },
      trafficMonitor: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      }
    })
    mockGetPreferredEvalsLayout.mockResolvedValue('b')

    const { default: EvalsPage } = await import('./page')
    const result = await EvalsPage()

    expect(mockGetEvalsDashboard).toHaveBeenCalledWith('admin-1')
    expect(mockGetPreferredEvalsLayout).toHaveBeenCalledWith('admin-1')
    expect(result).toBeTruthy()
  })
})
