'use client'

import { formatDistanceToNow } from 'date-fns'

import type { HealthState } from '@/lib/evals/helpers/health-state'
import {
  healthForScore,
  stateColor,
  stateLabel
} from '@/lib/evals/helpers/health-state'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { Sparkline } from './shared/sparkline'
import type { WidgetProps } from './shared/widget-props'
import { EvaluatorChipGrid } from './evaluator-chip-grid'
import { TrendChartInner } from './trend-chart-widget'

type Variant = 'hero' | 'column' | 'rail' | 'ring'

type Config = {
  suite: 'capability' | 'trafficMonitor'
  variant: Variant
  cadence?: string
  showTrend?: boolean
  showChips?: boolean
  showSparkline?: boolean
  showAlarmCount?: boolean
  alarmCount?: number
}

function percent(v: number) {
  return `${Math.round(v * 100)}%`
}

export function SuiteHeaderCard({
  data,
  config,
  breakpoint
}: WidgetProps<Config>) {
  const suiteKey = config.suite
  const suite = data[suiteKey]
  const latest = suite.latest
  if (!latest) {
    return (
      <Card className="h-full">
        <CardContent className="p-6 text-sm text-muted-foreground">
          No {suiteKey === 'capability' ? 'Capability' : 'Traffic Monitor'} runs
          yet.
        </CardContent>
      </Card>
    )
  }
  const previous = suite.previous
  const delta = previous ? latest.overallScore - previous.overallScore : null
  const state: HealthState = healthForScore(
    latest.overallScore,
    suiteKey === 'capability' ? 0.9 : 0.85,
    suiteKey === 'capability' ? 0.75 : 0.7
  )

  const title = suiteKey === 'capability' ? 'Capability' : 'Traffic Monitor'

  if (config.variant === 'rail') {
    return (
      <Card className="h-full">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="outline" className={stateColor(state)}>
            {stateLabel(state)}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-4xl font-semibold tabular-nums">
              {percent(latest.overallScore)}
            </span>
            <span className="text-xs text-muted-foreground">
              pass {percent(latest.passRate)}
              {delta != null
                ? ` · ${delta > 0 ? '+' : ''}${Math.round(delta * 100)} pts`
                : null}
            </span>
          </div>
          {config.showSparkline ? (
            <Sparkline trend={suite.trend} color="var(--chart-3)" />
          ) : null}
          {suite.lastUpdated ? (
            <p className="text-xs text-muted-foreground">
              Last run{' '}
              {formatDistanceToNow(new Date(suite.lastUpdated), {
                addSuffix: true
              })}
            </p>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  if (config.variant === 'ring') {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center gap-4 p-5">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${
              state === 'healthy'
                ? 'border-emerald-500/60'
                : state === 'warning'
                  ? 'border-amber-500/60'
                  : 'border-rose-500/60'
            }`}
          >
            <span className="text-lg font-semibold tabular-nums">
              {percent(latest.overallScore)}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">
              pass {percent(latest.passRate)}
              {delta != null
                ? ` · ${delta > 0 ? '+' : ''}${Math.round(delta * 100)} pts`
                : null}
            </p>
            {suite.lastUpdated ? (
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(suite.lastUpdated), {
                  addSuffix: true
                })}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (config.variant === 'column') {
    return (
      <Card className="h-full">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {config.cadence ? (
              <Badge variant="outline" className="text-xs">
                {config.cadence}
              </Badge>
            ) : null}
            {config.showAlarmCount &&
            config.alarmCount &&
            config.alarmCount > 0 ? (
              <Badge variant="destructive" className="ml-auto">
                {config.alarmCount} alarm{config.alarmCount > 1 ? 's' : ''}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-semibold tabular-nums">
              {percent(latest.overallScore)}
            </span>
            {delta != null ? (
              <span
                className={`text-sm font-medium ${
                  delta >= 0 ? stateColor('healthy') : stateColor('critical')
                }`}
              >
                {delta > 0 ? '+' : ''}
                {Math.round(delta * 100)} pts
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            pass {percent(latest.passRate)} · {latest.totalCases} cases
          </p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="truncate">exp: {latest.experimentName}</p>
            <p className="truncate">dataset: {latest.datasetName}</p>
          </div>
          {latest.phoenixUrl ? (
            <a
              href={latest.phoenixUrl}
              rel="noreferrer"
              target="_blank"
              className="inline-block text-xs text-primary underline underline-offset-4"
            >
              Open in Phoenix →
            </a>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {suiteKey === 'trafficMonitor'
                ? 'real user chats · sampled every 6h'
                : 'rehearsed · on-demand'}
            </p>
          </div>
          <Badge variant="outline" className={stateColor(state)}>
            {stateLabel(state)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {config.showTrend ? (
          <TrendChartInner trend={suite.trend} height={240} />
        ) : null}
        {config.showChips ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Evaluators
            </p>
            <EvaluatorChipGrid
              data={data}
              config={{ suite: suiteKey }}
              breakpoint={breakpoint}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
          <span>
            Experiment:{' '}
            <span className="text-foreground">{latest.experimentName}</span>
          </span>
          <span>
            Dataset:{' '}
            <span className="text-foreground">{latest.datasetName}</span>
          </span>
          <span>
            Cases: <span className="text-foreground">{latest.totalCases}</span>
          </span>
          {latest.phoenixUrl ? (
            <a
              className="ml-auto text-primary underline underline-offset-4"
              href={latest.phoenixUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open in Phoenix →
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
