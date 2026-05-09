import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { SuiteSelector } from './suite-selector'

const SNAP = (
  overrides: Partial<EvalSummarySnapshot> = {}
): EvalSummarySnapshot => ({
  id: 'x',
  suite: 'capability',
  experimentName: 'e',
  datasetName: 'd',
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
  createdAt: '2026-04-29T12:00:00.000Z',
  ...overrides
})

describe('SuiteSelector', () => {
  it('renders three suite tabs with their scores', () => {
    render(
      <SuiteSelector
        active="capability"
        onChange={() => {}}
        snaps={{
          capability: SNAP({ overallScore: 0.88 }),
          trafficMonitor: SNAP({
            suite: 'traffic-monitor',
            overallScore: 0.82
          }),
          regression: SNAP({ suite: 'regression', overallScore: 0.91 })
        }}
      />
    )
    expect(screen.getByRole('tab', { name: /test suite/i })).toBeInTheDocument()
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('91%')).toBeInTheDocument()
  })

  it('marks the active tab with aria-selected and the accent-blue ring', () => {
    render(
      <SuiteSelector
        active="trafficMonitor"
        onChange={() => {}}
        snaps={{
          capability: SNAP(),
          trafficMonitor: SNAP({ suite: 'traffic-monitor' }),
          regression: SNAP({ suite: 'regression' })
        }}
      />
    )
    const active = screen.getByRole('tab', { name: /traffic monitor/i })
    expect(active).toHaveAttribute('aria-selected', 'true')
    expect(active.querySelector('[data-testid="scoop-card-root"]')).toHaveClass(
      'ring-accent-blue'
    )
  })

  it('renders an ATTENTION chip on the suite flagged for attention', () => {
    render(
      <SuiteSelector
        active="capability"
        attentionSuite="trafficMonitor"
        onChange={() => {}}
        snaps={{
          capability: SNAP(),
          trafficMonitor: SNAP({
            suite: 'traffic-monitor',
            thresholdBreached: true,
            failedEvaluators: ['citation_accuracy']
          }),
          regression: SNAP({ suite: 'regression' })
        }}
      />
    )
    expect(screen.getByText(/ATTENTION/i)).toBeInTheDocument()
  })

  it('calls onChange with the suite id when a tab is clicked', () => {
    const onChange = vi.fn()
    render(
      <SuiteSelector
        active="capability"
        onChange={onChange}
        snaps={{
          capability: SNAP(),
          trafficMonitor: SNAP({ suite: 'traffic-monitor' }),
          regression: SNAP({ suite: 'regression' })
        }}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: /traffic monitor/i }))
    expect(onChange).toHaveBeenCalledWith('trafficMonitor')
  })
})
