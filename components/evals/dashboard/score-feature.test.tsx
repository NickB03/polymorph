import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ScoreFeature } from './score-feature'

const SNAP: EvalSummarySnapshot = {
  id: 'cap-1',
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
  createdAt: '2026-05-19T12:00:00.000Z'
}

function renderFeature(
  snap = SNAP,
  previous: EvalSummarySnapshot | null = null
) {
  return render(
    <TooltipProvider>
      <ScoreFeature cap={snap} previous={previous} />
    </TooltipProvider>
  )
}

describe('ScoreFeature', () => {
  it('renders the overall score percentage', () => {
    renderFeature()
    expect(screen.getByLabelText(/Test Suite score: 88%/i)).toBeInTheDocument()
  })

  it('renders the threshold comparison caption when above threshold', () => {
    renderFeature()
    expect(screen.getByText(/vs threshold 85%/)).toBeInTheDocument()
  })

  it('renders below-threshold copy in warning color when within watch band', () => {
    renderFeature({ ...SNAP, overallScore: 0.8, thresholdBreached: true })
    const caption = screen.getByText(/pts below 85%/)
    expect(caption).toBeInTheDocument()
    expect(caption).toHaveClass('text-warning')
  })

  it('renders below-threshold copy in destructive color when score breaches block band', () => {
    renderFeature({ ...SNAP, overallScore: 0.7, thresholdBreached: true })
    const caption = screen.getByText(/pts below 85%/)
    expect(caption).toBeInTheDocument()
    expect(caption).toHaveClass('text-destructive')
  })

  it('renders aggregate copy when threshold is null', () => {
    renderFeature({ ...SNAP, threshold: null })
    expect(screen.getByText('aggregate')).toBeInTheDocument()
  })
})
