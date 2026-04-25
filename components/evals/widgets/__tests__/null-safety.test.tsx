import type { ComponentType } from 'react'

import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import type {
  EvalsDashboardData,
  EvalSummarySnapshot,
  PersistedDashboardSuite
} from '@/lib/evals/types'

import { ActivityFeed } from '../activity-feed'
import { EvaluatorBarsWidget } from '../evaluator-bars-widget'
import { EvaluatorChipGrid } from '../evaluator-chip-grid'
import { EvaluatorComparisonGrid } from '../evaluator-comparison-grid'
import type { WidgetProps } from '../shared/widget-props'

beforeAll(() => {
  // jsdom does not implement matchMedia. Stub it the same way layout-renderer.test does
  // so any widget that consults useMatchMedia/useIsClient does not throw.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('1024px'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  })
})

function snap(
  id: string,
  suite: PersistedDashboardSuite,
  evaluatorScores: Record<string, number | null>
): EvalSummarySnapshot {
  return {
    id,
    suite,
    experimentName: `${id}-exp`,
    datasetName: `${id}-ds`,
    passRate: 0.9,
    threshold: 0.8,
    thresholdBreached: false,
    failedEvaluators: [],
    overallScore: 0.9,
    totalCases: 10,
    phoenixUrl: null,
    createdAt: '2026-04-14T10:00:00Z',
    evaluatorScores
  }
}

function dashboardData(): EvalsDashboardData {
  return {
    capability: {
      latest: snap('cap-l', 'capability', {
        faithfulness: null,
        relevance: 0.9
      }),
      previous: snap('cap-p', 'capability', {
        faithfulness: 0.85,
        relevance: 0.85
      }),
      trend: [],
      lastUpdated: null
    },
    trafficMonitor: {
      latest: snap('traf-l', 'traffic-monitor', {
        faithfulness: 0.92,
        relevance: null
      }),
      previous: snap('traf-p', 'traffic-monitor', {
        faithfulness: 0.9,
        relevance: 0.88
      }),
      trend: [],
      lastUpdated: null
    },
    regression: {
      latest: null,
      previous: null,
      trend: [],
      lastUpdated: null
    }
  }
}

// Each widget has its own narrow Config type (`{ suite }` for chip-grid /
// bars-widget, `{ expandedByDefault }` for activity-feed, none for
// comparison-grid). Cast through `unknown` so the parameterized table can hold
// all four uniformly without losing the runtime config each widget needs.
type WidgetCase = readonly [
  string,
  ComponentType<WidgetProps>,
  WidgetProps['config']
]

const cases: readonly WidgetCase[] = [
  ['EvaluatorComparisonGrid', EvaluatorComparisonGrid, {}],
  [
    'EvaluatorChipGrid',
    EvaluatorChipGrid as unknown as ComponentType<WidgetProps>,
    { suite: 'capability' } as unknown as WidgetProps['config']
  ],
  [
    'EvaluatorBarsWidget',
    EvaluatorBarsWidget as unknown as ComponentType<WidgetProps>,
    { suite: 'capability' } as unknown as WidgetProps['config']
  ],
  [
    // expandedByDefault must point at a feed row whose evaluatorScores contains a
    // null entry — otherwise the row stays collapsed and the H2 filter at
    // activity-feed.tsx:110-111 never renders. With cap-latest expanded,
    // a regression that drops the .filter would surface "0%" via percent(null)
    // → Math.round(null * 100) === 0, which the shared regex catches.
    'ActivityFeed',
    ActivityFeed as unknown as ComponentType<WidgetProps>,
    { expandedByDefault: 'cap-latest' } as unknown as WidgetProps['config']
  ]
]

describe('H2 null-skipping in widget consumers', () => {
  it.each(cases)(
    '%s does not render a 0%% row for a null evaluator score',
    (_, Component, config) => {
      const { container } = render(
        <Component data={dashboardData()} config={config} breakpoint="lg" />
      )

      // Heuristic: none of the test data contains a real 0% score (everything
      // is in the 85–92% range), so any rendered "0%" indicates a null was
      // coerced via `?? 0` and surfaced as a row. The widget-level H2 fixes
      // filter nulls before rendering; this regex catches a regression while
      // avoiding false positives on multi-digit percentages like "100%" by
      // anchoring on a non-digit (or start of string) before the `0%`.
      expect(container.textContent).not.toMatch(/(?:^|\D)0%/)
    }
  )
})
