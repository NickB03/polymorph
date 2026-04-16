export type WidgetTypeId =
  | 'page-header'
  | 'filter-toolbar'
  | 'kpi-tile'
  | 'suite-header-card'
  | 'score-ring'
  | 'trend-chart'
  | 'combined-trend-chart'
  | 'evaluator-bars'
  | 'evaluator-chip-grid'
  | 'evaluator-comparison-grid'
  | 'divergence-banner'
  | 'what-changed-card'
  | 'activity-feed'

export type TemplateId = 'a' | 'b' | 'c'
export type BreakpointKey = 'lg' | 'md' | 'sm'

export interface GridPosition {
  i: string
  x: number
  y: number
  w: number
  h: number
  static?: boolean
}

export type WidgetConfig = Record<string, unknown>

export interface WidgetInstance {
  id: string
  type: WidgetTypeId
  config?: WidgetConfig
}

export interface EvalsLayoutTemplate {
  id: TemplateId
  name: string
  description: string
  items: WidgetInstance[]
  layouts: Record<BreakpointKey, GridPosition[]>
}
