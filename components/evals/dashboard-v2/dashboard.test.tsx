import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

const mockSearchParamGet = vi.hoisted(() =>
  vi.fn<(key: string) => string | null>(() => null)
)

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockSearchParamGet
  })
}))

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

const POPULATED_CAPABILITY: EvalSummarySnapshot = {
  id: 'capability-latest',
  suite: 'capability',
  experimentName: 'eval-fixture',
  datasetName: 'fixture-dataset',
  passRate: 0.9,
  threshold: 0.85,
  thresholdBreached: false,
  failedEvaluators: [],
  overallScore: 0.88,
  evaluatorScores: { faithfulness: 0.9 },
  totalCases: 10,
  attemptedCases: 10,
  failedCases: 0,
  dropRate: 0,
  phoenixUrl: null,
  createdAt: '2026-04-29T12:00:00.000Z'
}

const POPULATED: EvalsDashboardData = {
  capability: {
    latest: POPULATED_CAPABILITY,
    previous: null,
    trend: [],
    lastUpdated: POPULATED_CAPABILITY.createdAt
  },
  regression: { latest: null, previous: null, trend: [], lastUpdated: null },
  trafficMonitor: {
    latest: null,
    previous: null,
    trend: [],
    lastUpdated: null
  },
  recentRuns: [POPULATED_CAPABILITY]
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

  it('renders the populated state without crashing', () => {
    render(<EvalsDashboardV2 data={POPULATED} />)
    expect(
      screen.getByRole('heading', { level: 1, name: /response quality/i })
    ).toBeInTheDocument()
  })
})
