import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { TooltipProvider } from '@/components/ui/tooltip'

import { EvaluatorBreakdown } from './evaluator-breakdown'

const SNAP_WITH_FAILED: EvalSummarySnapshot = {
  id: 'capability-latest',
  suite: 'capability',
  experimentName: 'eval-fixture',
  datasetName: 'fixture-dataset',
  passRate: 0.6,
  threshold: 0.85,
  thresholdBreached: true,
  failedEvaluators: ['faithfulness'],
  overallScore: 0.6,
  evaluatorScores: {
    faithfulness: 0.5,
    relevance: 0.95
  },
  totalCases: 10,
  attemptedCases: 10,
  failedCases: 0,
  dropRate: 0,
  phoenixUrl: null,
  createdAt: '2026-04-29T12:00:00.000Z'
}

function renderBreakdown(snap: EvalSummarySnapshot) {
  return render(
    <TooltipProvider>
      <EvaluatorBreakdown snap={snap} />
    </TooltipProvider>
  )
}

describe('EvaluatorBreakdown', () => {
  it('renders failed evaluators in the destructive color', () => {
    renderBreakdown(SNAP_WITH_FAILED)
    const failed = screen.getByText('Faithfulness')
    expect(failed).toHaveClass('text-destructive')
  })

  it('renders non-failed evaluators in the foreground color', () => {
    renderBreakdown(SNAP_WITH_FAILED)
    const passing = screen.getByText('Relevance')
    expect(passing).toHaveClass('text-foreground')
  })
})
