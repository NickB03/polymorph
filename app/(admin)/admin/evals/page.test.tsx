import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockRedirect = vi.hoisted(() => vi.fn())
const mockGetCurrentUser = vi.hoisted(() => vi.fn())
const mockGetEvalsDashboardWithLayout = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: mockRedirect
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: mockGetCurrentUser
}))

vi.mock('@/lib/evals/queries', () => ({
  getEvalsDashboardWithLayout: mockGetEvalsDashboardWithLayout
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

describe('/admin/evals page', () => {
  it('redirects logged-out users to /auth/login as a defensive fallback', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const { default: EvalsPage } = await import('./page')
    await EvalsPage()

    expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
  })

  it('loads dashboard data and layout preference and wires them to EvalsDashboardV2', async () => {
    const mockData = {
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
    }
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mockGetEvalsDashboardWithLayout.mockResolvedValue({
      data: mockData,
      layout: 'b'
    })

    const { default: EvalsPage } = await import('./page')
    const result = await EvalsPage()
    render(result as React.ReactElement)

    expect(mockGetEvalsDashboardWithLayout).toHaveBeenCalledWith('admin-1')
    const dashboard = screen.getByTestId('dashboard-v2')
    expect(dashboard).toHaveAttribute('data-layout', 'b')
    expect(dashboard).toHaveTextContent(JSON.stringify(mockData))
  })
})
