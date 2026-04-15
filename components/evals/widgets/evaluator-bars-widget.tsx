import { EvaluatorBars } from '@/components/evals/evaluator-bars'

import type { WidgetProps } from './shared/widget-props'

type Config = {
  suite: 'capability' | 'trafficMonitor'
}

export function EvaluatorBarsWidget({ data, config }: WidgetProps<Config>) {
  const latest = data[config.suite].latest
  if (!latest) return null
  return <EvaluatorBars evaluatorScores={latest.evaluatorScores} />
}
