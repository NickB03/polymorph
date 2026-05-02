import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

function snapshot(
  overrides: Partial<EvalSummarySnapshot> = {}
): EvalSummarySnapshot {
  return {
    ...POPULATED_CAPABILITY,
    ...overrides,
    evaluatorScores:
      overrides.evaluatorScores ?? POPULATED_CAPABILITY.evaluatorScores,
    failedEvaluators:
      overrides.failedEvaluators ?? POPULATED_CAPABILITY.failedEvaluators
  }
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
  beforeEach(() => {
    mockSearchParamGet.mockReset()
    mockSearchParamGet.mockReturnValue(null)
    window.history.replaceState({}, '', '/admin/evals')
  })

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

  it('defaults to traffic monitor when capability is empty and live traffic has data', () => {
    const trafficMonitor = snapshot({
      id: 'traffic-latest',
      suite: 'traffic-monitor',
      datasetName: 'traffic-dataset',
      experimentName: 'traffic-fixture',
      totalCases: 5
    })
    const regression = snapshot({
      id: 'regression-latest',
      suite: 'regression',
      datasetName: 'regression-dataset',
      experimentName: 'regression-fixture',
      totalCases: 7
    })

    render(
      <EvalsDashboardV2
        data={{
          ...EMPTY,
          trafficMonitor: {
            latest: trafficMonitor,
            previous: null,
            trend: [],
            lastUpdated: trafficMonitor.createdAt
          },
          regression: {
            latest: regression,
            previous: null,
            trend: [],
            lastUpdated: regression.createdAt
          },
          recentRuns: [regression, trafficMonitor]
        }}
      />
    )

    expect(screen.getAllByText('traffic-dataset').length).toBeGreaterThan(0)
    expect(screen.getByRole('tab', { name: /live traffic/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('falls back to a populated suite when the URL selects an empty suite', () => {
    mockSearchParamGet.mockImplementation(key =>
      key === 'suite' ? 'capability' : null
    )
    const trafficMonitor = snapshot({
      id: 'traffic-latest',
      suite: 'traffic-monitor',
      datasetName: 'traffic-dataset',
      experimentName: 'traffic-fixture',
      totalCases: 5
    })
    const regression = snapshot({
      id: 'regression-latest',
      suite: 'regression',
      datasetName: 'regression-dataset',
      experimentName: 'regression-fixture',
      totalCases: 7
    })

    render(
      <EvalsDashboardV2
        data={{
          ...EMPTY,
          trafficMonitor: {
            latest: trafficMonitor,
            previous: null,
            trend: [],
            lastUpdated: trafficMonitor.createdAt
          },
          regression: {
            latest: regression,
            previous: null,
            trend: [],
            lastUpdated: regression.createdAt
          },
          recentRuns: [regression, trafficMonitor]
        }}
      />
    )

    expect(screen.getAllByText('traffic-dataset').length).toBeGreaterThan(0)
    expect(screen.getByText('Evaluator breakdown')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /live traffic/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('defaults to regression when it is the only suite with data', () => {
    const regression = snapshot({
      id: 'regression-latest',
      suite: 'regression',
      datasetName: 'regression-dataset',
      experimentName: 'regression-fixture',
      totalCases: 7
    })

    render(
      <EvalsDashboardV2
        data={{
          ...EMPTY,
          regression: {
            latest: regression,
            previous: null,
            trend: [],
            lastUpdated: regression.createdAt
          },
          recentRuns: [regression]
        }}
      />
    )

    expect(screen.getAllByText('regression-dataset').length).toBeGreaterThan(0)
    expect(screen.getByText('Evaluator breakdown')).toBeInTheDocument()
  })

  it('counts capability, traffic monitor, and regression cases in the subtitle', () => {
    const capability = snapshot({ id: 'capability-latest', totalCases: 2 })
    const trafficMonitor = snapshot({
      id: 'traffic-latest',
      suite: 'traffic-monitor',
      totalCases: 3
    })
    const regression = snapshot({
      id: 'regression-latest',
      suite: 'regression',
      totalCases: 5
    })

    render(
      <EvalsDashboardV2
        data={{
          capability: {
            latest: capability,
            previous: null,
            trend: [],
            lastUpdated: capability.createdAt
          },
          trafficMonitor: {
            latest: trafficMonitor,
            previous: null,
            trend: [],
            lastUpdated: trafficMonitor.createdAt
          },
          regression: {
            latest: regression,
            previous: null,
            trend: [],
            lastUpdated: regression.createdAt
          },
          recentRuns: [regression, trafficMonitor, capability]
        }}
      />
    )

    expect(
      screen.getByText(/10 cases scored in the last 48h/i)
    ).toBeInTheDocument()
  })
})
