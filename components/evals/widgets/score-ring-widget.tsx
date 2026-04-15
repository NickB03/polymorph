import { ScoreRing } from '@/components/evals/score-ring'

import type { WidgetProps } from './shared/widget-props'

type Config = {
  suite: 'capability' | 'trafficMonitor'
  label?: string
}

export function ScoreRingWidget({ data, config }: WidgetProps<Config>) {
  const suite = data[config.suite]
  const latest = suite.latest
  if (!latest) return null
  const previous = suite.previous
  const delta = previous ? latest.overallScore - previous.overallScore : null
  return (
    <ScoreRing
      label={
        config.label ??
        (config.suite === 'capability' ? 'Capability' : 'Traffic Monitor')
      }
      score={latest.overallScore}
      passRate={latest.passRate}
      delta={delta}
    />
  )
}
