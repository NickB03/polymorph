import type { BreakpointKey, WidgetConfig } from '@/lib/evals/layout/types'
import type { EvalsDashboardData } from '@/lib/evals/types'

export interface WidgetProps<C extends WidgetConfig = WidgetConfig> {
  data: EvalsDashboardData
  config: C
  breakpoint: BreakpointKey
}
