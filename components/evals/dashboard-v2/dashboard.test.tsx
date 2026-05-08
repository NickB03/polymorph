import { fireEvent, render, screen } from '@testing-library/react'
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
      screen.getByRole('heading', { level: 1, name: /^evaluation$/i })
    ).toBeInTheDocument()
    expect(screen.queryByText(/polymorph/i)).not.toBeInTheDocument()
  })

  it('renders the populated state without crashing', () => {
    render(<EvalsDashboardV2 data={POPULATED} />)
    expect(
      screen.getByRole('heading', { level: 1, name: /^evaluation$/i })
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
    expect(
      screen.getByRole('tab', { name: /production evals/i })
    ).toHaveAttribute('aria-selected', 'true')
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
    expect(
      screen.getByRole('tab', { name: /production evals/i })
    ).toHaveAttribute('aria-selected', 'true')
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

  it('defaults to a threshold-breached Production Evals suite while keeping Test Suite naming', () => {
    const capability = snapshot({
      id: 'capability-latest',
      suite: 'capability',
      datasetName: 'capability-dataset',
      passRate: 0.92,
      thresholdBreached: false
    })
    const trafficMonitor = snapshot({
      id: 'traffic-latest',
      suite: 'traffic-monitor',
      datasetName: 'traffic-dataset',
      passRate: 0.78,
      threshold: 0.85,
      thresholdBreached: true,
      failedEvaluators: ['citation_accuracy'],
      phoenixUrl:
        'https://phoenix.example.com/datasets/traffic-dataset/compare?experimentId=traffic-experiment'
    })

    render(
      <EvalsDashboardV2
        data={{
          ...EMPTY,
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
          recentRuns: [trafficMonitor, capability]
        }}
      />
    )

    expect(screen.getByText('Phoenix insight')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Production Evals is below threshold while Test Suite is healthy.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /production evals/i })
    ).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByText('traffic-dataset').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('tab', { name: /test suite/i })
    ).toHaveAccessibleName('Test Suite')
  })

  it('preserves an explicit populated suite URL even when another suite needs attention', () => {
    mockSearchParamGet.mockImplementation(key =>
      key === 'suite' ? 'capability' : null
    )
    const capability = snapshot({
      id: 'capability-latest',
      suite: 'capability',
      datasetName: 'capability-dataset',
      thresholdBreached: false
    })
    const trafficMonitor = snapshot({
      id: 'traffic-latest',
      suite: 'traffic-monitor',
      datasetName: 'traffic-dataset',
      passRate: 0.78,
      threshold: 0.85,
      thresholdBreached: true,
      failedEvaluators: ['citation_accuracy']
    })

    render(
      <EvalsDashboardV2
        data={{
          ...EMPTY,
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
          recentRuns: [trafficMonitor, capability]
        }}
      />
    )

    expect(screen.getByText('Phoenix insight')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /test suite/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getAllByText('capability-dataset').length).toBeGreaterThan(0)
  })

  it('lets the Phoenix insight review button select the alerting suite', () => {
    mockSearchParamGet.mockImplementation(key =>
      key === 'suite' ? 'capability' : null
    )
    const capability = snapshot({
      id: 'capability-latest',
      suite: 'capability',
      datasetName: 'capability-dataset',
      thresholdBreached: false
    })
    const trafficMonitor = snapshot({
      id: 'traffic-latest',
      suite: 'traffic-monitor',
      datasetName: 'traffic-dataset',
      passRate: 0.78,
      threshold: 0.85,
      thresholdBreached: true,
      failedEvaluators: ['citation_accuracy']
    })

    render(
      <EvalsDashboardV2
        data={{
          ...EMPTY,
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
          recentRuns: [trafficMonitor, capability]
        }}
      />
    )

    fireEvent.click(
      screen.getByRole('button', { name: /review production evals/i })
    )

    expect(
      screen.getByRole('tab', { name: /production evals/i })
    ).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByText('traffic-dataset').length).toBeGreaterThan(0)
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
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' &&
          (el.textContent ?? '').includes('10') &&
          /cases scored in the last 48h/i.test(el.textContent ?? '')
      )
    ).toBeInTheDocument()
  })

  it('renders a READY status pill when no suite is in trouble', () => {
    render(<EvalsDashboardV2 data={POPULATED} />)
    expect(screen.getByTestId('overall-status-pill')).toHaveTextContent(/READY/)
  })

  it('renders a BLOCKED status pill when any suite breaches threshold', () => {
    const breached = snapshot({
      thresholdBreached: true,
      failedEvaluators: ['faithfulness']
    })
    render(
      <EvalsDashboardV2
        data={{
          ...POPULATED,
          capability: {
            latest: breached,
            previous: null,
            trend: [],
            lastUpdated: breached.createdAt
          }
        }}
      />
    )
    expect(screen.getByTestId('overall-status-pill')).toHaveTextContent(
      /BLOCKED/
    )
  })
})
