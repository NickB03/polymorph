import type { ComponentType } from 'react'

import type { WidgetTypeId } from '@/lib/evals/layout/types'
import type { EvalsDashboardData } from '@/lib/evals/types'

import type { WidgetProps } from './shared/widget-props'
import { ActivityFeed } from './activity-feed'
import { CombinedTrendChart } from './combined-trend-chart'
import {
  canRenderDivergenceBanner,
  DivergenceBanner
} from './divergence-banner'
import { EvaluatorBarsWidget } from './evaluator-bars-widget'
import { EvaluatorChipGrid } from './evaluator-chip-grid'
import { EvaluatorComparisonGrid } from './evaluator-comparison-grid'
import { KpiTile } from './kpi-tile'
import { PageHeader } from './page-header'
import { ScoreRingWidget } from './score-ring-widget'
import { SuiteHeaderCard } from './suite-header-card'
import { WhatChangedCard } from './what-changed-card'

export interface WidgetEntry {
  Component: ComponentType<WidgetProps>
  /**
   * Optional predicate. If provided and returns false, LayoutRenderer skips
   * the widget entirely (no wrapper grid slot reserved). When omitted, the
   * widget is always mounted.
   */
  canRender?: (data: EvalsDashboardData) => boolean
}

export const WIDGET_REGISTRY: Record<WidgetTypeId, WidgetEntry> = {
  'page-header': { Component: PageHeader as ComponentType<WidgetProps> },
  'kpi-tile': { Component: KpiTile as ComponentType<WidgetProps> },
  'suite-header-card': {
    Component: SuiteHeaderCard as ComponentType<WidgetProps>
  },
  'score-ring': { Component: ScoreRingWidget as ComponentType<WidgetProps> },
  'combined-trend-chart': {
    Component: CombinedTrendChart as ComponentType<WidgetProps>
  },
  'evaluator-bars': {
    Component: EvaluatorBarsWidget as ComponentType<WidgetProps>
  },
  'evaluator-chip-grid': {
    Component: EvaluatorChipGrid as ComponentType<WidgetProps>
  },
  'evaluator-comparison-grid': {
    Component: EvaluatorComparisonGrid as ComponentType<WidgetProps>
  },
  'divergence-banner': {
    Component: DivergenceBanner as ComponentType<WidgetProps>,
    canRender: canRenderDivergenceBanner
  },
  'what-changed-card': {
    Component: WhatChangedCard as ComponentType<WidgetProps>
  },
  'activity-feed': { Component: ActivityFeed as ComponentType<WidgetProps> }
}
