import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

import { LayoutRenderer } from './layout-renderer'

beforeAll(() => {
  // jsdom does not implement matchMedia. LayoutRenderer calls it from a
  // useEffect to pick a breakpoint; stub it so the effect runs without
  // throwing. Always returning matches=true for the lg query keeps the
  // smoke test pinned to the lg layout, which is what we assert against.
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

function emptyData(): EvalsDashboardData {
  const emptySuite = {
    latest: null,
    previous: null,
    trend: [],
    lastUpdated: null
  }
  return {
    capability: emptySuite,
    regression: emptySuite,
    trafficMonitor: emptySuite
  }
}

function snapshot(
  suite: 'capability' | 'traffic-monitor'
): EvalSummarySnapshot {
  return {
    id: `${suite}-1`,
    suite,
    experimentName: 'x',
    datasetName: 'x',
    passRate: 0.9,
    threshold: null,
    thresholdBreached: false,
    failedEvaluators: [],
    overallScore: 0.9,
    evaluatorScores: { faithfulness: 0.9 },
    totalCases: 10,
    phoenixUrl: null,
    createdAt: new Date().toISOString()
  }
}

describe('LayoutRenderer', () => {
  it('does not render a grid slot for a widget whose canRender returns false', () => {
    const template = {
      id: 'b' as const,
      name: 'Test',
      description: 'Test',
      items: [{ id: 'divergence', type: 'divergence-banner' as const }],
      layouts: {
        lg: [{ i: 'divergence', x: 0, y: 0, w: 12, h: 1 }],
        md: [{ i: 'divergence', x: 0, y: 0, w: 12, h: 1 }],
        sm: [{ i: 'divergence', x: 0, y: 0, w: 12, h: 1 }]
      }
    }

    // Only capability has data → DivergenceBanner needs both, so canRender is false.
    const data: EvalsDashboardData = {
      ...emptyData(),
      capability: {
        latest: snapshot('capability'),
        previous: null,
        trend: [],
        lastUpdated: null
      }
    }

    const { container } = render(
      <LayoutRenderer template={template} data={data} />
    )
    expect(container.querySelector('[data-widget-id="divergence"]')).toBeNull()
  })

  it('renders the grid slot when canRender returns true', () => {
    const template = {
      id: 'b' as const,
      name: 'Test',
      description: 'Test',
      items: [{ id: 'divergence', type: 'divergence-banner' as const }],
      layouts: {
        lg: [{ i: 'divergence', x: 0, y: 0, w: 12, h: 1 }],
        md: [{ i: 'divergence', x: 0, y: 0, w: 12, h: 1 }],
        sm: [{ i: 'divergence', x: 0, y: 0, w: 12, h: 1 }]
      }
    }

    // Both suites have wide divergent scores → canRender returns true.
    const data: EvalsDashboardData = {
      ...emptyData(),
      capability: {
        latest: {
          ...snapshot('capability'),
          evaluatorScores: { faithfulness: 0.95 }
        },
        previous: null,
        trend: [],
        lastUpdated: null
      },
      trafficMonitor: {
        latest: {
          ...snapshot('traffic-monitor'),
          evaluatorScores: { faithfulness: 0.5 }
        },
        previous: null,
        trend: [],
        lastUpdated: null
      }
    }

    const { container } = render(
      <LayoutRenderer template={template} data={data} />
    )
    expect(
      container.querySelector('[data-widget-id="divergence"]')
    ).not.toBeNull()
  })
})
