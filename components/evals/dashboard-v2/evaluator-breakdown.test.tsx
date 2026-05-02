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
  failedCases: 1,
  dropRate: 0,
  phoenixUrl: null,
  createdAt: '2026-04-29T12:00:00.000Z',
  appModelIds: ['gpt-4.1-mini'],
  primaryAppModelId: 'gpt-4.1-mini',
  judgeModel: 'openai/gpt-4o',
  judgeSettings: { temperature: 0 },
  corpusVersion: 'v6',
  datasetVersion: 'dataset-version-1',
  evaluatorTemplateVersion: 'v1',
  caseResults: [
    {
      id: 'case-result-1',
      evalSummaryId: 'capability-latest',
      suite: 'capability',
      experimentName: 'eval-fixture',
      experimentRunId: 'run-1',
      datasetExampleId: 'example-1',
      caseId: 'case-1',
      evaluatorName: 'faithfulness',
      annotatorKind: 'LLM',
      score: 0,
      label: 'unfaithful',
      explanation: 'The answer contradicted retrieved context.',
      error: null,
      failed: true,
      failureMode: 'contradicts_context',
      appModelId: 'gpt-4.1-mini',
      modelType: 'chat',
      searchMode: 'auto',
      correlationId: 'corr-1',
      otelTraceId: 'trace-1',
      evaluatorTraceId: 'judge-trace-1',
      phoenixUrl: 'https://phoenix.example.com/trace-1',
      createdAt: '2026-04-29T12:00:00.000Z'
    }
  ]
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
    const failed = screen.getByText('Groundedness')
    expect(failed).toHaveClass('text-destructive')
  })

  it('renders non-failed evaluators in the foreground color', () => {
    renderBreakdown(SNAP_WITH_FAILED)
    const passing = screen.getByText('Relevance')
    expect(passing).toHaveClass('text-foreground')
  })

  it('renders release status, metadata, and diagnostic examples', () => {
    renderBreakdown(SNAP_WITH_FAILED)

    expect(screen.getByText('Release status')).toBeInTheDocument()
    expect(screen.getByText('BLOCKED')).toBeInTheDocument()
    expect(screen.getByText('Worst failing cases')).toBeInTheDocument()
    expect(screen.getAllByText('case-1').length).toBeGreaterThan(0)
    expect(screen.getByText('Groundedness diagnostics')).toBeInTheDocument()
    expect(
      screen.getByText('The answer contradicted retrieved context.')
    ).toBeInTheDocument()
    expect(screen.getAllByText('gpt-4.1-mini').length).toBeGreaterThan(0)
    expect(screen.getByText('openai/gpt-4o')).toBeInTheDocument()
  })
})
