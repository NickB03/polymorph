import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PhoenixInsight } from './attention'
import { PhoenixInsightStrip } from './phoenix-insight'

const INSIGHT: PhoenixInsight = {
  suiteId: 'trafficMonitor',
  summary: 'Faithfulness on Traffic Monitor dropped 6 pts vs. previous run',
  interpretation:
    'Threshold not breached — keeping at WATCH. Review the worst-failing cases below.',
  actionLabel: 'Review',
  alert: {
    snapshotId: 'traffic-latest',
    suite: 'traffic-monitor',
    suiteLabel: 'Traffic Monitor',
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
  it('renders the explanation', () => {
    render(<PhoenixInsightStrip insight={INSIGHT} onReview={() => {}} />)

    expect(screen.getByText('Phoenix insight')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Faithfulness on Traffic Monitor dropped 6 pts vs. previous run'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Threshold not breached — keeping at WATCH. Review the worst-failing cases below.'
      )
    ).toBeInTheDocument()
    expect(screen.getByTestId('phoenix-alert-icon')).toBeInTheDocument()
  })

  it('calls onReview when the review button is clicked', () => {
    const onReview = vi.fn()

    render(<PhoenixInsightStrip insight={INSIGHT} onReview={onReview} />)

    fireEvent.click(screen.getByRole('button', { name: /^review$/i }))

    expect(onReview).toHaveBeenCalledTimes(1)
  })

  it('renders the destructive palette when severity is "blocked"', () => {
    render(
      <PhoenixInsightStrip
        insight={INSIGHT}
        onReview={() => {}}
        severity="blocked"
      />
    )
    expect(screen.getByTestId('phoenix-insight')).toHaveClass(
      'border-destructive'
    )
  })
})
