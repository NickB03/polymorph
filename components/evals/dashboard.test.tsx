import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { EvalsDashboardData } from '@/lib/evals/types'

vi.mock('./trend-chart', () => ({
  TrendChart: ({ title }: { title: string }) => (
    <div data-testid="trend-chart">{title}</div>
  )
}))

vi.mock('./evaluator-bars', () => ({
  EvaluatorBars: () => <div data-testid="evaluator-bars" />
}))

vi.mock('./score-ring', () => ({
  ScoreRing: ({ label }: { label: string }) => (
    <div data-testid="score-ring">{label}</div>
  )
}))

import EvalsDashboard from './dashboard'

const emptySuite = {
  latest: null,
  previous: null,
  trend: [],
  lastUpdated: null
}

const populatedSuite = (overrides: { experimentName: string }) => ({
  latest: {
    id: 'summary-1',
    experimentName: overrides.experimentName,
    datasetName: 'dataset-1',
    passRate: 0.92,
    overallScore: 0.91,
    evaluatorScores: { faithfulness: 0.9, relevance: 0.92 },
    totalCases: 25,
    phoenixUrl: 'https://phoenix.example.com/1',
    createdAt: '2026-04-13T00:00:00.000Z'
  },
  previous: null,
  trend: [],
  lastUpdated: '2026-04-13T00:00:00.000Z'
})

describe('EvalsDashboard', () => {
  it('renders the global empty state when both suites are empty', () => {
    render(
      <EvalsDashboard
        data={{
          capability: emptySuite,
          trafficMonitor: emptySuite
        }}
      />
    )

    expect(screen.getByText('No eval summaries yet')).toBeInTheDocument()
    expect(
      screen.getByText(/run the capability or traffic-monitor eval suite/i)
    ).toBeInTheDocument()
  })

  it('renders an empty capability section alongside a populated traffic-monitor section', () => {
    const data: EvalsDashboardData = {
      capability: emptySuite,
      trafficMonitor: populatedSuite({ experimentName: 'tm-exp-1' })
    }

    render(<EvalsDashboard data={data} />)

    expect(
      screen.getByText('Capability — no summaries yet')
    ).toBeInTheDocument()
    expect(screen.getByText('Traffic Monitor')).toBeInTheDocument()
    expect(screen.getByText('tm-exp-1')).toBeInTheDocument()
    expect(screen.getByText('Traffic Monitor Trend')).toBeInTheDocument()
  })

  it('renders both populated suite sections with distinct trend chart titles', () => {
    const data: EvalsDashboardData = {
      capability: populatedSuite({ experimentName: 'cap-exp-1' }),
      trafficMonitor: populatedSuite({ experimentName: 'tm-exp-1' })
    }

    render(<EvalsDashboard data={data} />)

    expect(screen.getByText('Capability')).toBeInTheDocument()
    expect(screen.getByText('Traffic Monitor')).toBeInTheDocument()
    expect(screen.getByText('cap-exp-1')).toBeInTheDocument()
    expect(screen.getByText('tm-exp-1')).toBeInTheDocument()
    expect(screen.getByText('Capability Trend')).toBeInTheDocument()
    expect(screen.getByText('Traffic Monitor Trend')).toBeInTheDocument()
  })
})
