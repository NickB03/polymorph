import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ActivityList } from '@/components/evals/dashboard/activity-list'

const baseSnapshot = (
  overrides: Partial<EvalSummarySnapshot> = {}
): EvalSummarySnapshot => ({
  id: 'run-1',
  suite: 'capability',
  experimentName: 'exp-1',
  datasetName: 'dataset-1',
  passRate: 0.9,
  threshold: 0.8,
  thresholdBreached: false,
  failedEvaluators: [],
  overallScore: 0.9,
  evaluatorScores: {
    faithfulness: 0.9,
    relevance: 0.9
  },
  totalCases: 10,
  attemptedCases: 10,
  failedCases: 0,
  dropRate: 0,
  phoenixUrl: null,
  createdAt: '2026-04-29T12:00:00.000Z',
  ...overrides
})

function dataWithRecentRuns(
  recentRuns: EvalSummarySnapshot[]
): EvalsDashboardData {
  const capabilityRuns = recentRuns.filter(run => run.suite === 'capability')
  const regressionRuns = recentRuns.filter(run => run.suite === 'regression')
  const trafficRuns = recentRuns.filter(run => run.suite === 'traffic-monitor')

  return {
    capability: {
      latest: capabilityRuns[0] ?? null,
      previous: capabilityRuns[1] ?? null,
      trend: [],
      lastUpdated: capabilityRuns[0]?.createdAt ?? null
    },
    regression: {
      latest: regressionRuns[0] ?? null,
      previous: regressionRuns[1] ?? null,
      trend: [],
      lastUpdated: regressionRuns[0]?.createdAt ?? null
    },
    trafficMonitor: {
      latest: trafficRuns[0] ?? null,
      previous: trafficRuns[1] ?? null,
      trend: [],
      lastUpdated: trafficRuns[0]?.createdAt ?? null
    },
    recentRuns
  }
}

function renderActivityList(data: EvalsDashboardData) {
  return render(
    <TooltipProvider>
      <ActivityList data={data} />
    </TooltipProvider>
  )
}

describe('ActivityList', () => {
  it('renders multiple persisted runs newest-first and compares deltas by suite', () => {
    const capabilityOld = baseSnapshot({
      id: 'cap-old',
      overallScore: 0.84,
      passRate: 0.84,
      createdAt: '2026-04-29T08:00:00.000Z'
    })
    const trafficNew = baseSnapshot({
      id: 'traffic-new',
      suite: 'traffic-monitor',
      overallScore: 0.8,
      passRate: 0.8,
      createdAt: '2026-04-29T10:00:00.000Z'
    })
    const capabilityNew = baseSnapshot({
      id: 'cap-new',
      overallScore: 0.9,
      passRate: 0.9,
      createdAt: '2026-04-29T12:00:00.000Z'
    })

    renderActivityList(
      dataWithRecentRuns([capabilityNew, trafficNew, capabilityOld])
    )

    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Test Suite')
    expect(rows[0]).toHaveTextContent('90%')
    expect(rows[0]).toHaveTextContent('+6')
    expect(rows[1]).toHaveTextContent('Traffic Monitor')
    expect(rows[1]).toHaveTextContent('80%')
    expect(rows[2]).toHaveTextContent('Test Suite')
    expect(rows[2]).toHaveTextContent('84%')
  })

  it('renders the trend caption when there are at least 2 recent runs', () => {
    const run1 = baseSnapshot({
      id: 'cap-1',
      overallScore: 0.84,
      createdAt: '2026-04-29T08:00:00.000Z'
    })
    const run2 = baseSnapshot({
      id: 'cap-2',
      overallScore: 0.9,
      createdAt: '2026-04-29T12:00:00.000Z'
    })
    renderActivityList(dataWithRecentRuns([run2, run1]))
    expect(screen.getByText(/Score trend/i)).toBeInTheDocument()
  })

  it('hides the trend chart when there is only one recent run', () => {
    const run1 = baseSnapshot({
      id: 'cap-1',
      overallScore: 0.9,
      createdAt: '2026-04-29T12:00:00.000Z'
    })
    renderActivityList(dataWithRecentRuns([run1]))
    expect(screen.queryByText(/Score trend/i)).not.toBeInTheDocument()
  })

  it('keeps expanded score bars visible inside focusable tooltip rows', () => {
    const capabilityNew = baseSnapshot({
      id: 'cap-new',
      evaluatorScores: { faithfulness: 0.9, relevance: 0.82 },
      overallScore: 0.9,
      passRate: 0.9
    })

    renderActivityList(dataWithRecentRuns([capabilityNew]))

    const meters = screen.getAllByRole('meter')
    expect(meters).toHaveLength(2)
    expect(meters[0]).toHaveClass('block', 'w-full')
    expect(meters[0]).toHaveAttribute(
      'aria-valuetext',
      'Faithfulness score 90%, on track, 80% threshold, 10 cases'
    )

    const scoreBars = screen.getAllByTestId('score-bar')
    expect(scoreBars).toHaveLength(2)
    expect(screen.getAllByTestId('score-bar-fill')[0]).toHaveStyle({
      width: '90%'
    })
    expect(screen.getAllByTestId('score-bar-threshold')[0]).toHaveStyle({
      left: '80%'
    })
  })
})
