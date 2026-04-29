'use client'

import type {
  EvalsDashboardData,
  EvalSummarySnapshot,
  EvalTrendPoint
} from '@/lib/evals/types'

import { EvalsDashboardV2 } from '@/components/evals/dashboard-v2/dashboard'

const DEMO_NOW = Date.UTC(2026, 3, 29, 20, 48, 0)
const HOUR = 60 * 60 * 1000

function trend(seed: number, count = 14): EvalTrendPoint[] {
  const out: EvalTrendPoint[] = []
  let v = 0.78 + (seed % 7) / 100
  for (let i = count - 1; i >= 0; i -= 1) {
    v = Math.max(0.55, Math.min(0.97, v + Math.sin(seed + i) * 0.04))
    out.push({
      createdAt: new Date(DEMO_NOW - i * 24 * HOUR).toISOString(),
      passRate: Math.max(0.5, Math.min(1, v - 0.02)),
      overallScore: v
    })
  }
  return out
}

function snap(
  suite: EvalSummarySnapshot['suite'],
  overrides: Partial<EvalSummarySnapshot> = {}
): EvalSummarySnapshot {
  const totalCases = overrides.totalCases ?? 32
  return {
    id: `${suite}-${overrides.createdAt ?? 'latest'}`,
    suite,
    experimentName: 'eval-2026-04-28-r3',
    datasetName:
      suite === 'capability'
        ? 'curated-prompts-v4'
        : suite === 'regression'
          ? 'regression-fixtures-v2'
          : 'real-traffic-rolling-7d',
    passRate: 0.92,
    threshold: 0.85,
    thresholdBreached: false,
    failedEvaluators: [],
    overallScore: 0.89,
    evaluatorScores: {
      faithfulness: 0.94,
      relevance: 0.91,
      safety: 0.99,
      response_quality: 0.88,
      citation_accuracy: 0.83,
      tool_usage: 0.9,
      deterministic_prechecks: 1.0
    },
    totalCases,
    attemptedCases: overrides.attemptedCases ?? totalCases,
    failedCases: 0,
    dropRate: 0,
    phoenixUrl: 'https://phoenix-production-c6b5.up.railway.app',
    createdAt: new Date(DEMO_NOW - 2 * HOUR).toISOString(),
    ...overrides
  }
}

const CAPABILITY_LATEST = snap('capability', {
  passRate: 0.94,
  overallScore: 0.91,
  totalCases: 24,
  evaluatorScores: {
    faithfulness: 0.95,
    relevance: 0.93,
    safety: 1.0,
    response_quality: 0.9,
    citation_accuracy: 0.88,
    tool_usage: 0.92,
    deterministic_prechecks: 1.0
  }
})

const CAPABILITY_PREVIOUS = snap('capability', {
  passRate: 0.91,
  overallScore: 0.88,
  totalCases: 24,
  createdAt: new Date(DEMO_NOW - 26 * HOUR).toISOString()
})

const REGRESSION_LATEST = snap('regression', {
  passRate: 0.96,
  overallScore: 0.93,
  totalCases: 18,
  createdAt: new Date(DEMO_NOW - 8 * HOUR).toISOString()
})

const REGRESSION_PREVIOUS = snap('regression', {
  passRate: 0.95,
  overallScore: 0.93,
  totalCases: 18,
  createdAt: new Date(DEMO_NOW - 50 * HOUR).toISOString()
})

const TRAFFIC_LATEST = snap('traffic-monitor', {
  passRate: 0.81,
  overallScore: 0.78,
  totalCases: 47,
  threshold: 0.85,
  thresholdBreached: true,
  failedEvaluators: ['citation_accuracy'],
  createdAt: new Date(DEMO_NOW - 4 * HOUR).toISOString(),
  evaluatorScores: {
    faithfulness: 0.86,
    relevance: 0.82,
    safety: 0.99,
    response_quality: 0.79,
    citation_accuracy: 0.62,
    tool_usage: 0.85,
    deterministic_prechecks: 1.0
  }
})

const TRAFFIC_PREVIOUS = snap('traffic-monitor', {
  passRate: 0.84,
  overallScore: 0.82,
  totalCases: 47,
  createdAt: new Date(DEMO_NOW - 50 * HOUR).toISOString()
})

const MOCK: EvalsDashboardData = {
  capability: {
    latest: CAPABILITY_LATEST,
    previous: CAPABILITY_PREVIOUS,
    trend: trend(11),
    lastUpdated: CAPABILITY_LATEST.createdAt
  },
  regression: {
    latest: REGRESSION_LATEST,
    previous: REGRESSION_PREVIOUS,
    trend: trend(7, 10),
    lastUpdated: REGRESSION_LATEST.createdAt
  },
  trafficMonitor: {
    latest: TRAFFIC_LATEST,
    previous: TRAFFIC_PREVIOUS,
    trend: trend(3),
    lastUpdated: TRAFFIC_LATEST.createdAt
  },
  recentRuns: [
    CAPABILITY_LATEST,
    TRAFFIC_LATEST,
    REGRESSION_LATEST,
    CAPABILITY_PREVIOUS,
    TRAFFIC_PREVIOUS,
    REGRESSION_PREVIOUS
  ]
}

export function MixedEvalsDashboard() {
  return <EvalsDashboardV2 data={MOCK} footer={<DemoFootnote />} />
}

function DemoFootnote() {
  return (
    <footer className="mt-4 flex items-start justify-between gap-6 border-t border-border/60 pt-6 text-xs text-muted-foreground">
      <p className="max-w-2xl leading-relaxed">
        Demo surface - mock data. Hover any underlined term for its definition.
        The sectioned alternative lives at{' '}
        <span className="font-mono">/admin/evals/demo</span>.
      </p>
      <span className="font-mono text-[11px] text-muted-foreground">
        v3.7 - production fixture
      </span>
    </footer>
  )
}
