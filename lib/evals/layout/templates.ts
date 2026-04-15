import type { EvalsLayoutTemplate, GridPosition, TemplateId } from './types'

function toStacked(lg: GridPosition[]): GridPosition[] {
  let y = 0
  return lg.map(p => {
    const next = { i: p.i, x: 0, y, w: 12, h: p.h, static: p.static }
    y += p.h
    return next
  })
}

export const TEMPLATE_A: EvalsLayoutTemplate = {
  id: 'a',
  name: 'Health Monitor',
  description: 'KPI strip + Traffic hero + Capability rail',
  items: [
    {
      id: 'header',
      type: 'page-header',
      config: { title: 'Evals · Health Monitor', subtitle: 'lastSync' }
    },
    {
      id: 'kpi-health',
      type: 'kpi-tile',
      config: { metric: 'systemHealth', suite: 'trafficMonitor' }
    },
    {
      id: 'kpi-pass',
      type: 'kpi-tile',
      config: {
        metric: 'passRate',
        suite: 'trafficMonitor',
        sparkline: true
      }
    },
    {
      id: 'kpi-overall',
      type: 'kpi-tile',
      config: {
        metric: 'overallScore',
        suite: 'trafficMonitor',
        sparkline: true
      }
    },
    {
      id: 'kpi-samples',
      type: 'kpi-tile',
      config: { metric: 'sampleCount', suite: 'trafficMonitor' }
    },
    {
      id: 'kpi-freshness',
      type: 'kpi-tile',
      config: { metric: 'freshness', suite: 'trafficMonitor' }
    },
    {
      id: 'traffic-hero',
      type: 'suite-header-card',
      config: {
        suite: 'trafficMonitor',
        variant: 'hero',
        showTrend: true,
        showChips: true
      }
    },
    {
      id: 'capability-rail',
      type: 'suite-header-card',
      config: {
        suite: 'capability',
        variant: 'rail',
        showSparkline: true
      }
    }
  ],
  layouts: {
    lg: [
      { i: 'header', x: 0, y: 0, w: 12, h: 1, static: true },
      { i: 'kpi-health', x: 0, y: 1, w: 2, h: 2 },
      { i: 'kpi-pass', x: 2, y: 1, w: 3, h: 2 },
      { i: 'kpi-overall', x: 5, y: 1, w: 3, h: 2 },
      { i: 'kpi-samples', x: 8, y: 1, w: 2, h: 2 },
      { i: 'kpi-freshness', x: 10, y: 1, w: 2, h: 2 },
      { i: 'traffic-hero', x: 0, y: 3, w: 9, h: 8 },
      { i: 'capability-rail', x: 9, y: 3, w: 3, h: 8 }
    ],
    md: [
      { i: 'header', x: 0, y: 0, w: 12, h: 1, static: true },
      { i: 'kpi-health', x: 0, y: 1, w: 4, h: 2 },
      { i: 'kpi-pass', x: 4, y: 1, w: 4, h: 2 },
      { i: 'kpi-overall', x: 8, y: 1, w: 4, h: 2 },
      { i: 'kpi-samples', x: 0, y: 3, w: 6, h: 2 },
      { i: 'kpi-freshness', x: 6, y: 3, w: 6, h: 2 },
      { i: 'traffic-hero', x: 0, y: 5, w: 12, h: 8 },
      { i: 'capability-rail', x: 0, y: 13, w: 12, h: 4 }
    ],
    // sm collapses the 5 KPI tiles into a single `kpi-health` pill that
    // rolls up system health, pass rate, and alarm count. Stacking 5 individual
    // tiles vertically on a phone forces the user to scroll past all of them
    // before reaching the Traffic hero. The `kpi-tile` widget renders the
    // SystemHealthPill variant when `config.metric === 'systemHealth'` AND
    // `breakpoint === 'sm'`. Items `kpi-pass`, `kpi-overall`, `kpi-samples`,
    // `kpi-freshness` intentionally stay in `items[]` but have no sm position
    // — the templates test uses subset containment, so unrendered items are
    // permitted at the cost of a one-way invariant. See wireframe
    // `evals-v2-template-a-sm` (node id `WvlZ4`) in polymorph.pen.
    sm: toStacked([
      { i: 'header', x: 0, y: 0, w: 12, h: 1, static: true },
      { i: 'kpi-health', x: 0, y: 1, w: 12, h: 3 },
      { i: 'traffic-hero', x: 0, y: 4, w: 12, h: 8 },
      { i: 'capability-rail', x: 0, y: 12, w: 12, h: 4 }
    ])
  }
}

export const TEMPLATE_B: EvalsLayoutTemplate = {
  id: 'b',
  name: 'Rehearsed vs. Real',
  description: 'Two-column suite comparison + divergence banner',
  items: [
    {
      id: 'header',
      type: 'page-header',
      config: {
        title: 'Evals · Rehearsed vs. Real',
        subtitle: 'bothSuites'
      }
    },
    { id: 'divergence', type: 'divergence-banner', config: { topN: 3 } },
    {
      id: 'cap-header',
      type: 'suite-header-card',
      config: {
        suite: 'capability',
        variant: 'column',
        cadence: 'on-demand'
      }
    },
    {
      id: 'traf-header',
      type: 'suite-header-card',
      config: {
        suite: 'trafficMonitor',
        variant: 'column',
        cadence: 'every 6h',
        showAlarmCount: true
      }
    },
    {
      id: 'combined-trend',
      type: 'combined-trend-chart',
      config: { title: 'Trend · both suites overlaid' }
    },
    {
      id: 'comparison-grid',
      type: 'evaluator-comparison-grid',
      config: { highlightDivergence: true }
    }
  ],
  layouts: {
    lg: [
      { i: 'header', x: 0, y: 0, w: 12, h: 1, static: true },
      { i: 'divergence', x: 0, y: 1, w: 12, h: 1 },
      { i: 'cap-header', x: 0, y: 2, w: 6, h: 4 },
      { i: 'traf-header', x: 6, y: 2, w: 6, h: 4 },
      { i: 'combined-trend', x: 0, y: 6, w: 12, h: 6 },
      { i: 'comparison-grid', x: 0, y: 12, w: 12, h: 8 }
    ],
    md: [
      { i: 'header', x: 0, y: 0, w: 12, h: 1, static: true },
      { i: 'divergence', x: 0, y: 1, w: 12, h: 1 },
      { i: 'cap-header', x: 0, y: 2, w: 6, h: 4 },
      { i: 'traf-header', x: 6, y: 2, w: 6, h: 4 },
      { i: 'combined-trend', x: 0, y: 6, w: 12, h: 6 },
      { i: 'comparison-grid', x: 0, y: 12, w: 12, h: 8 }
    ],
    sm: toStacked([
      { i: 'header', x: 0, y: 0, w: 12, h: 1, static: true },
      { i: 'divergence', x: 0, y: 1, w: 12, h: 1 },
      { i: 'traf-header', x: 0, y: 2, w: 12, h: 4 },
      { i: 'cap-header', x: 0, y: 6, w: 12, h: 4 },
      { i: 'combined-trend', x: 0, y: 10, w: 12, h: 6 },
      { i: 'comparison-grid', x: 0, y: 16, w: 12, h: 8 }
    ])
  }
}

export const TEMPLATE_C: EvalsLayoutTemplate = {
  id: 'c',
  name: 'Activity Feed',
  description: 'What-changed summary + reverse-chron feed',
  items: [
    {
      id: 'header',
      type: 'page-header',
      config: {
        title: 'Evals · Activity',
        subtitle: 'what changed in the last 24 hours'
      }
    },
    { id: 'filters', type: 'filter-toolbar', config: {} },
    { id: 'ring-cap', type: 'score-ring', config: { suite: 'capability' } },
    {
      id: 'ring-traf',
      type: 'score-ring',
      config: { suite: 'trafficMonitor' }
    },
    {
      id: 'what-changed',
      type: 'what-changed-card',
      config: { maxItems: 6 }
    },
    {
      id: 'feed',
      type: 'activity-feed',
      config: { expandedByDefault: 'worst-drop-or-latest' }
    }
  ],
  layouts: {
    lg: [
      { i: 'header', x: 0, y: 0, w: 8, h: 1, static: true },
      { i: 'filters', x: 8, y: 0, w: 4, h: 1, static: true },
      { i: 'ring-cap', x: 0, y: 1, w: 6, h: 6 },
      { i: 'ring-traf', x: 6, y: 1, w: 6, h: 6 },
      { i: 'what-changed', x: 0, y: 7, w: 12, h: 4 },
      { i: 'feed', x: 0, y: 11, w: 12, h: 10 }
    ],
    md: [
      { i: 'header', x: 0, y: 0, w: 12, h: 1, static: true },
      { i: 'filters', x: 0, y: 1, w: 12, h: 1, static: true },
      { i: 'ring-cap', x: 0, y: 2, w: 6, h: 6 },
      { i: 'ring-traf', x: 6, y: 2, w: 6, h: 6 },
      { i: 'what-changed', x: 0, y: 8, w: 12, h: 4 },
      { i: 'feed', x: 0, y: 12, w: 12, h: 10 }
    ],
    sm: toStacked([
      { i: 'header', x: 0, y: 0, w: 12, h: 1, static: true },
      { i: 'filters', x: 0, y: 1, w: 12, h: 1, static: true },
      { i: 'ring-cap', x: 0, y: 2, w: 12, h: 6 },
      { i: 'ring-traf', x: 0, y: 8, w: 12, h: 6 },
      { i: 'what-changed', x: 0, y: 14, w: 12, h: 4 },
      { i: 'feed', x: 0, y: 18, w: 12, h: 10 }
    ])
  }
}

export const TEMPLATES: EvalsLayoutTemplate[] = [
  TEMPLATE_A,
  TEMPLATE_B,
  TEMPLATE_C
]
export const DEFAULT_TEMPLATE_ID: TemplateId = 'c'

export function getTemplate(id: TemplateId): EvalsLayoutTemplate {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATE_C
}
