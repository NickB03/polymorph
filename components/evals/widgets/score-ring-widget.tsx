import { Activity } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { ScoreRing } from '@/components/evals/score-ring'

import type { WidgetProps } from './shared/widget-props'

type Config = {
  suite: 'capability' | 'trafficMonitor'
  label?: string
}

export function ScoreRingWidget({ data, config }: WidgetProps<Config>) {
  const suite = data[config.suite]
  const latest = suite.latest
  const label =
    config.label ??
    (config.suite === 'capability' ? 'Capability' : 'Traffic Monitor')
  if (!latest) {
    const helper =
      config.suite === 'capability'
        ? 'Runs on demand from the rehearsed suite.'
        : 'Runs every 6h from the evals cron.'
    return (
      <Card className="flex h-full flex-col border-dashed bg-muted/10">
        <CardHeader>
          <CardTitle className="text-lg">{label}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 pb-6 text-center">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <svg
              className="h-full w-full -rotate-90"
              viewBox="0 0 180 180"
              aria-hidden
            >
              <circle
                cx="90"
                cy="90"
                r="72"
                stroke="currentColor"
                strokeWidth="14"
                className="text-muted/40"
                strokeDasharray="6 10"
                fill="none"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/60">
              <Activity aria-hidden className="h-6 w-6" />
              <span className="mt-1 text-xs">no data</span>
            </div>
          </div>
          <p className="max-w-[18rem] text-xs text-muted-foreground">
            {helper}
          </p>
        </CardContent>
      </Card>
    )
  }
  const previous = suite.previous
  const delta = previous ? latest.overallScore - previous.overallScore : null
  return (
    <ScoreRing
      label={label}
      score={latest.overallScore}
      passRate={latest.passRate}
      delta={delta}
    />
  )
}
