import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { EvalsDashboardData } from '@/lib/evals/types'

import { EvalsDashboardV2 } from '@/components/evals/dashboard-v2/dashboard'

import { MixedEvalsDashboard } from './mixed-dashboard'

vi.mock('@/components/evals/dashboard-v2/dashboard', () => ({
  EvalsDashboardV2: vi.fn(
    ({ data, footer }: { data: EvalsDashboardData; footer?: ReactNode }) => (
      <section data-testid="shared-dashboard">
        <span data-testid="recent-count">{data.recentRuns.length}</span>
        <span>{data.capability.latest?.datasetName}</span>
        {footer}
      </section>
    )
  )
}))

describe('MixedEvalsDashboard', () => {
  it('renders the production dashboard shell with rich mock data', () => {
    render(<MixedEvalsDashboard />)

    expect(screen.getByTestId('shared-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('recent-count')).toHaveTextContent('6')
    expect(screen.getByText('curated-prompts-v4')).toBeInTheDocument()
    expect(screen.getByText(/Demo surface — mock data/i)).toBeInTheDocument()

    const dashboard = vi.mocked(EvalsDashboardV2)
    expect(dashboard).toHaveBeenCalledTimes(1)

    const props = dashboard.mock.calls[0][0]
    expect(props.data.trafficMonitor.latest?.createdAt).toBe(
      '2026-04-29T16:48:00.000Z'
    )
    expect(props.data.trafficMonitor.latest?.thresholdBreached).toBe(true)
    expect(props.data.recentRuns.map(run => run.suite)).toEqual([
      'capability',
      'traffic-monitor',
      'regression',
      'capability',
      'traffic-monitor',
      'regression'
    ])
  })
})
