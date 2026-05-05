import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PhoenixInsight } from './attention'
import { PhoenixInsightStrip } from './phoenix-insight'

const INSIGHT: PhoenixInsight = {
  suiteId: 'trafficMonitor',
  summary: 'Production Evals is below threshold while Test Suite is healthy.',
  interpretation:
    'This points to live-traffic drift rather than a broad baseline regression.',
  actionLabel: 'Review Production Evals',
  alert: {
    snapshotId: 'traffic-latest',
    suite: 'traffic-monitor',
    suiteLabel: 'Production Evals',
    experimentName: 'traffic-monitor-2026-05-05',
    datasetName: 'traffic-sample-48h',
    passRate: 0.78,
    threshold: 0.85,
    failedEvaluators: ['citation_accuracy', 'response_quality'],
    totalCases: 36,
    phoenixUrl:
      'https://phoenix.example.com/datasets/traffic-sample-48h/compare?experimentId=traffic-monitor-2026-05-05',
    createdAt: '2026-05-05T12:00:00.000Z'
  }
}

describe('PhoenixInsightStrip', () => {
  it('renders the explanation, score context, and Phoenix experiment link', () => {
    render(<PhoenixInsightStrip insight={INSIGHT} onReview={() => {}} />)

    expect(screen.getByText('Phoenix insight')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Production Evals is below threshold while Test Suite is healthy.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'This points to live-traffic drift rather than a broad baseline regression.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/78% pass rate/i)).toBeInTheDocument()
    expect(screen.getByText(/85% threshold/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open phoenix/i })).toHaveAttribute(
      'href',
      'https://phoenix.example.com/datasets/traffic-sample-48h/compare?experimentId=traffic-monitor-2026-05-05'
    )
  })

  it('calls onReview when the review button is clicked', () => {
    const onReview = vi.fn()

    render(<PhoenixInsightStrip insight={INSIGHT} onReview={onReview} />)

    fireEvent.click(
      screen.getByRole('button', { name: /review production evals/i })
    )

    expect(onReview).toHaveBeenCalledTimes(1)
  })
})
