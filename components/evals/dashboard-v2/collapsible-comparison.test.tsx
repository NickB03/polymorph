import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

vi.mock('@/components/evals/dashboard/comparison-table', () => ({
  ComparisonTable: () => (
    <div data-testid="comparison-table">comparison content</div>
  )
}))

import { CollapsibleComparison } from './collapsible-comparison'

const SNAP: EvalSummarySnapshot = {
  id: 'snap',
  suite: 'capability',
  experimentName: 'eval-fixture',
  datasetName: 'fixture-dataset',
  passRate: 0.9,
  threshold: 0.85,
  thresholdBreached: false,
  failedEvaluators: [],
  overallScore: 0.88,
  evaluatorScores: {},
  totalCases: 10,
  attemptedCases: 10,
  failedCases: 0,
  dropRate: 0,
  phoenixUrl: null,
  createdAt: '2026-04-29T12:00:00.000Z'
}

describe('CollapsibleComparison', () => {
  it('mounts the comparison table by default', () => {
    render(<CollapsibleComparison cap={SNAP} traf={SNAP} />)
    expect(screen.getByTestId('comparison-table')).toBeInTheDocument()
  })

  it('collapses when the floating chevron is clicked', () => {
    render(<CollapsibleComparison cap={SNAP} traf={SNAP} />)
    fireEvent.click(
      screen.getByRole('button', { name: /collapse comparison/i })
    )
    expect(screen.queryByTestId('comparison-table')).not.toBeInTheDocument()
  })

  it('re-expands when the banner trigger is clicked', () => {
    render(<CollapsibleComparison cap={SNAP} traf={SNAP} />)
    fireEvent.click(
      screen.getByRole('button', { name: /collapse comparison/i })
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: /where test and production diverge/i
      })
    )
    expect(screen.getByTestId('comparison-table')).toBeInTheDocument()
  })
})
