import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData } from '@/lib/evals/types'

import { EvalsDashboardV2 } from './dashboard'

const EMPTY: EvalsDashboardData = {
  capability: { latest: null, previous: null, trend: [], lastUpdated: null },
  regression: { latest: null, previous: null, trend: [], lastUpdated: null },
  trafficMonitor: {
    latest: null,
    previous: null,
    trend: [],
    lastUpdated: null
  },
  recentRuns: []
}

describe('EvalsDashboardV2', () => {
  it('renders the empty state when no suite has data', () => {
    render(<EvalsDashboardV2 data={EMPTY} />)
    expect(
      screen.getByText(/no evaluation runs have landed/i)
    ).toBeInTheDocument()
  })

  it('renders the header in any state', () => {
    render(<EvalsDashboardV2 data={EMPTY} />)
    expect(
      screen.getByRole('heading', { level: 1, name: /response quality/i })
    ).toBeInTheDocument()
  })

  it('renders an optional footer inside the dashboard shell', () => {
    render(<EvalsDashboardV2 data={EMPTY} footer={<p>Fixture footer</p>} />)
    expect(screen.getByText('Fixture footer')).toBeInTheDocument()
  })
})
