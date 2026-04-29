import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ComparisonTable } from './comparison-table'

const snapshot = (
  suite: EvalSummarySnapshot['suite'],
  overrides: Partial<EvalSummarySnapshot> = {}
): EvalSummarySnapshot => ({
  id: `${suite}-run`,
  suite,
  experimentName: `${suite}-experiment`,
  datasetName: `${suite}-dataset`,
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

function renderComparison(cap: EvalSummarySnapshot, traf: EvalSummarySnapshot) {
  return render(
    <TooltipProvider>
      <ComparisonTable cap={cap} traf={traf} />
    </TooltipProvider>
  )
}

describe('ComparisonTable', () => {
  it('renders threshold-aware score bars without replacing delta cues', () => {
    renderComparison(
      snapshot('capability', {
        threshold: 0.7,
        evaluatorScores: {
          faithfulness: 0.82,
          relevance: 0.9
        }
      }),
      snapshot('traffic-monitor', {
        threshold: 0.8,
        failedEvaluators: ['relevance'],
        evaluatorScores: {
          faithfulness: 0.82,
          relevance: 0.65
        }
      })
    )

    expect(screen.getAllByRole('meter')).toHaveLength(4)
    expect(screen.getAllByTestId('score-bar')).toHaveLength(4)

    const statuses = screen
      .getAllByTestId('score-bar')
      .map(bar => bar.getAttribute('data-score-status'))
    expect(statuses).toEqual([
      'on-track',
      'near-threshold',
      'on-track',
      'below-threshold'
    ])
    expect(screen.getAllByTestId('score-bar-fill')[0]).toHaveStyle({
      width: '82%'
    })
    expect(screen.getAllByText('-25')).toHaveLength(1)
  })
})
