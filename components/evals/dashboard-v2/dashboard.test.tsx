import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_TEMPLATE_ID,
  getTemplate,
  TEMPLATE_A,
  TEMPLATE_B,
  TEMPLATE_C
} from '@/lib/evals/layout/templates'
import type { EvalsDashboardData } from '@/lib/evals/types'

import { EvalsDashboardV2 } from './dashboard'

vi.mock('@/lib/actions/eval-preferences', () => ({
  setPreferredEvalsLayout: vi.fn().mockResolvedValue({ success: true })
}))

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

function makeSnapshot(suite: 'capability' | 'regression' | 'traffic-monitor') {
  return {
    id: `db-cuid-${suite}`,
    suite,
    experimentName: `exp-${suite}`,
    datasetName: `ds-${suite}`,
    passRate: 0.88,
    threshold: 0.8,
    thresholdBreached: false,
    failedEvaluators: [],
    overallScore: 0.9,
    evaluatorScores: {
      faithfulness: 0.92,
      relevance: 0.9,
      safety: 0.95,
      response_quality: 0.88,
      citation_accuracy: 0.86
    },
    totalCases: 12,
    phoenixUrl: 'https://phoenix.example.com/experiment/abc',
    createdAt: '2026-04-14T10:00:00Z'
  }
}

function makeTrendPoint(createdAt: string, overallScore: number) {
  return { createdAt, overallScore, passRate: overallScore - 0.02 }
}

function makeData(): EvalsDashboardData {
  return {
    capability: {
      latest: makeSnapshot('capability'),
      previous: {
        ...makeSnapshot('capability'),
        id: 'prev',
        overallScore: 0.87
      },
      trend: [
        makeTrendPoint('2026-04-12T10:00:00Z', 0.87),
        makeTrendPoint('2026-04-13T10:00:00Z', 0.89),
        makeTrendPoint('2026-04-14T10:00:00Z', 0.9)
      ],
      lastUpdated: '2026-04-14T10:00:00Z'
    },
    regression: {
      latest: null,
      previous: null,
      trend: [],
      lastUpdated: null
    },
    trafficMonitor: {
      latest: {
        ...makeSnapshot('traffic-monitor'),
        overallScore: 0.82,
        createdAt: '2026-04-14T12:00:00Z'
      },
      previous: {
        ...makeSnapshot('traffic-monitor'),
        id: 'traf-prev',
        overallScore: 0.84,
        createdAt: '2026-04-14T06:00:00Z'
      },
      trend: [
        makeTrendPoint('2026-04-14T00:00:00Z', 0.83),
        makeTrendPoint('2026-04-14T06:00:00Z', 0.84),
        makeTrendPoint('2026-04-14T12:00:00Z', 0.82)
      ],
      lastUpdated: '2026-04-14T12:00:00Z'
    }
  }
}

function makeEmptyData(): EvalsDashboardData {
  return {
    capability: { latest: null, previous: null, trend: [], lastUpdated: null },
    regression: { latest: null, previous: null, trend: [], lastUpdated: null },
    trafficMonitor: {
      latest: null,
      previous: null,
      trend: [],
      lastUpdated: null
    }
  }
}

describe('EvalsDashboardV2', () => {
  it('renders the default template', () => {
    render(
      <EvalsDashboardV2 data={makeData()} initialLayout={DEFAULT_TEMPLATE_ID} />
    )
    expect(
      screen.getByRole('radiogroup', { name: /evals layout/i })
    ).toBeInTheDocument()
  })

  it.each([
    ['a', TEMPLATE_A],
    ['b', TEMPLATE_B],
    ['c', TEMPLATE_C]
  ] as const)(
    'mounts every widget instance declared in template %s',
    (id, template) => {
      render(<EvalsDashboardV2 data={makeData()} initialLayout={id} />)
      const bp: 'lg' | 'md' | 'sm' = 'lg'
      const positionIds = new Set(template.layouts[bp].map(p => p.i))
      for (const item of template.items) {
        if (!positionIds.has(item.id)) continue
        const wrapper = document.querySelector(`[data-widget-id="${item.id}"]`)
        expect(
          wrapper,
          `widget "${item.id}" (type ${item.type}) did not render`
        ).toBeTruthy()
      }
    }
  )

  it('template B renders the updated live cadence copy', () => {
    render(<EvalsDashboardV2 data={makeData()} initialLayout="b" />)

    expect(screen.getByText('daily')).toBeInTheDocument()
    expect(screen.queryByText('every 6h')).not.toBeInTheDocument()
  })

  it('renders a top-level alert banner for the newest threshold breach', () => {
    const data = makeData()
    data.regression.latest = {
      ...makeSnapshot('regression'),
      thresholdBreached: true,
      failedEvaluators: ['faithfulness'],
      passRate: 0.63,
      createdAt: '2026-04-14T13:00:00Z'
    }

    render(<EvalsDashboardV2 data={data} initialLayout="a" />)

    expect(screen.getByTestId('eval-alert-banner')).toBeInTheDocument()
    expect(
      screen.getByText('Regression fell below its recorded threshold.')
    ).toBeInTheDocument()
  })

  it('keeps the empty state when only regression data exists', () => {
    const data = makeEmptyData()
    data.regression.latest = makeSnapshot('regression')

    render(<EvalsDashboardV2 data={data} initialLayout="a" />)

    expect(screen.getByTestId('evals-empty-state-bypass')).toBeInTheDocument()
  })

  it('template C expands the row matching the worst drop finding', () => {
    const data = makeData()
    data.trafficMonitor.previous!.evaluatorScores = {
      ...data.trafficMonitor.previous!.evaluatorScores,
      response_quality: 0.92
    }
    data.trafficMonitor.latest!.evaluatorScores = {
      ...data.trafficMonitor.latest!.evaluatorScores,
      response_quality: 0.8
    }

    render(<EvalsDashboardV2 data={data} initialLayout="c" />)

    const expanded = document.querySelector(
      '[data-feed-row-id="traf-latest"][data-expanded="true"]'
    )
    expect(
      expanded,
      'expected traf-latest (the row carrying the worst drop) to be expanded'
    ).toBeTruthy()
  })

  it('template C falls back to feed[0] when no drops exist', () => {
    render(<EvalsDashboardV2 data={makeData()} initialLayout="c" />)
    const expanded = document.querySelectorAll(
      '[data-feed-row-id][data-expanded="true"]'
    )
    expect(expanded).toHaveLength(1)
    expect(expanded[0].getAttribute('data-feed-row-id')).toBe('traf-latest')
  })

  it('getTemplate returns a template for every template id', () => {
    for (const id of ['a', 'b', 'c'] as const) {
      const tpl = getTemplate(id)
      expect(tpl.id).toBe(id)
      expect(tpl.items.length).toBeGreaterThan(0)
    }
  })

  it.each(['a', 'b', 'c'] as const)(
    'template %s renders EvalsEmptyState when both suites return null',
    id => {
      render(<EvalsDashboardV2 data={makeEmptyData()} initialLayout={id} />)
      const emptyState = screen.getByTestId('evals-empty-state')
      expect(emptyState).toBeInTheDocument()
      expect(emptyState).toHaveAttribute('data-template-id', id)
      expect(
        screen.getByRole('radiogroup', { name: /evals layout/i })
      ).toBeInTheDocument()
    }
  )
})
