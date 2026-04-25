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

export const WIDGET_REGISTRY: Record<
  WidgetTypeId,
  ComponentType<WidgetProps>
> = {
  'page-header': PageHeader as ComponentType<WidgetProps>,
  'kpi-tile': KpiTile as ComponentType<WidgetProps>,
  'suite-header-card': SuiteHeaderCard as ComponentType<WidgetProps>,
  'score-ring': ScoreRingWidget as ComponentType<WidgetProps>,
  'combined-trend-chart': CombinedTrendChart as ComponentType<WidgetProps>,
  'evaluator-bars': EvaluatorBarsWidget as ComponentType<WidgetProps>,
  'evaluator-chip-grid': EvaluatorChipGrid as ComponentType<WidgetProps>,
  'evaluator-comparison-grid':
    EvaluatorComparisonGrid as ComponentType<WidgetProps>,
  'divergence-banner': DivergenceBanner as ComponentType<WidgetProps>,
  'what-changed-card': WhatChangedCard as ComponentType<WidgetProps>,
  'activity-feed': ActivityFeed as ComponentType<WidgetProps>
}

export const WIDGET_CAN_RENDER: Partial<
  Record<WidgetTypeId, (data: EvalsDashboardData) => boolean>
> = {
  'divergence-banner': canRenderDivergenceBanner
}
