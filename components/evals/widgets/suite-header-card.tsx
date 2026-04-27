'use client'

import { formatDistanceToNow } from 'date-fns'
import { Activity, BarChart3 } from 'lucide-react'

import { computeFindings } from '@/lib/evals/helpers/findings'
import type { HealthState } from '@/lib/evals/helpers/health-state'
import {
  healthForScore,
  stateColor,
  stateLabel
} from '@/lib/evals/helpers/health-state'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { percent } from './shared/format'
import { Sparkline } from './shared/sparkline'
import type { WidgetProps } from './shared/widget-props'
import { EvaluatorChipGrid } from './evaluator-chip-grid'
import { TrendChartInner } from './trend-chart-widget'

type Variant = 'hero' | 'column' | 'rail'

type Config = {
  suite: 'capability' | 'regression' | 'trafficMonitor'
  variant: Variant
  cadence?: string
  showTrend?: boolean
  showChips?: boolean
  showSparkline?: boolean
  showAlarmCount?: boolean
}

export function SuiteHeaderCard({
  data,
  config,
  breakpoint
}: WidgetProps<Config>) {
  const suiteKey = config.suite
  const suite = data[suiteKey]
  const latest = suite.latest
  const title =
    suiteKey === 'capability'
      ? 'Capability'
      : suiteKey === 'regression'
        ? 'Regression'
        : 'Traffic Monitor'
  if (!latest) {
    return <SuiteEmptyState title={title} variant={config.variant} />
  }
  const previous = suite.previous
  const delta = previous ? latest.overallScore - previous.overallScore : null
  const state: HealthState = healthForScore(
    latest.overallScore,
    suiteKey === 'trafficMonitor' ? 0.85 : 0.9,
    suiteKey === 'trafficMonitor' ? 0.7 : 0.75
  )
  const alarmCount = config.showAlarmCount
    ? computeFindings(data).filter(
        f =>
          f.severity !== 'improvement' &&
          (f.snapshotId === latest.id ||
            f.snapshotId === (suite.previous?.id ?? ''))
      ).length
    : 0

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
            {alarmCount > 0 ? (
              <Badge variant="destructive" className="ml-auto">
                {alarmCount} alarm{alarmCount > 1 ? 's' : ''}
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
                ? 'real user chats · sampled daily'
                : suiteKey === 'regression'
                  ? 'regression fixtures · guard against drift'
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

function SuiteEmptyState({
  title,
  variant
}: {
  title: string
  variant: Variant
}) {
  const Icon = variant === 'hero' ? Activity : BarChart3
  const helper =
    title === 'Traffic Monitor'
      ? 'Runs land daily from the evals cron or on manual trigger.'
      : title === 'Regression'
        ? 'Runs land when a regression fixture exercise is triggered.'
        : 'Runs land on demand from the rehearsed suite.'

  if (variant === 'rail') {
    return (
      <Card className="flex h-full flex-col border-dashed bg-muted/10">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="outline" className="text-muted-foreground">
            No data
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
          <div className="rounded-full border border-dashed border-muted-foreground/30 p-3 text-muted-foreground">
            <Icon aria-hidden className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </CardContent>
      </Card>
    )
  }

  if (variant === 'column') {
    return (
      <Card className="flex h-full flex-col border-dashed bg-muted/10">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            <Badge variant="outline" className="text-muted-foreground">
              No data
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="rounded-full border border-dashed border-muted-foreground/30 p-3 text-muted-foreground">
            <Icon aria-hidden className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col border-dashed bg-muted/10">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {title === 'Traffic Monitor'
                ? 'real user chats · sampled daily'
                : title === 'Regression'
                  ? 'regression fixtures · guard against drift'
                  : 'rehearsed · on-demand'}
            </p>
          </div>
          <Badge variant="outline" className="text-muted-foreground">
            No data
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="rounded-full border border-dashed border-muted-foreground/30 p-4 text-muted-foreground">
          <Icon aria-hidden className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{title} hasn&apos;t run yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  )
}
