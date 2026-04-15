import { formatDistanceToNow } from 'date-fns'

import { computeFindings } from '@/lib/evals/helpers/findings'
import type { HealthState } from '@/lib/evals/helpers/health-state'
import {
  healthForScore,
  stateBg,
  stateColor,
  stateLabel
} from '@/lib/evals/helpers/health-state'

import { Card, CardContent } from '@/components/ui/card'

import { Sparkline } from './shared/sparkline'
import type { WidgetProps } from './shared/widget-props'

type Metric =
  | 'systemHealth'
  | 'passRate'
  | 'overallScore'
  | 'sampleCount'
  | 'freshness'

type Config = {
  metric: Metric
  suite: 'capability' | 'trafficMonitor'
  sparkline?: boolean
}

const HOUR = 60 * 60 * 1000

function percent(v: number) {
  return `${Math.round(v * 100)}%`
}

function formatDeltaPts(delta: number | null) {
  if (delta == null) return null
  const rounded = Math.round(delta * 100)
  if (rounded === 0) return '0 pts'
  return `${rounded > 0 ? '+' : ''}${rounded} pts`
}

export function KpiTile({ data, config, breakpoint }: WidgetProps<Config>) {
  if (breakpoint === 'sm' && config.metric === 'systemHealth') {
    return <SystemHealthPill data={data} config={config} />
  }

  const suite = data[config.suite]
  const latest = suite.latest
  if (!latest) {
    return (
      <Card className="border">
        <CardContent className="p-4 text-xs text-muted-foreground">
          {config.metric} unavailable
        </CardContent>
      </Card>
    )
  }

  const previous = suite.previous

  let value: string
  let delta: string | null = null
  let state: HealthState = 'healthy'
  let label: string

  switch (config.metric) {
    case 'systemHealth':
      label = 'System Health'
      value = percent(latest.overallScore)
      state = healthForScore(latest.overallScore, 0.85, 0.7)
      break
    case 'passRate':
      label = 'Pass Rate'
      value = percent(latest.passRate)
      delta = formatDeltaPts(
        previous ? latest.passRate - previous.passRate : null
      )
      state = healthForScore(latest.passRate, 0.9, 0.8)
      break
    case 'overallScore':
      label = 'Overall Score'
      value = latest.overallScore.toFixed(2)
      delta = formatDeltaPts(
        previous ? latest.overallScore - previous.overallScore : null
      )
      state = healthForScore(latest.overallScore, 0.85, 0.7)
      break
    case 'sampleCount':
      label = 'Samples'
      value = String(latest.totalCases)
      state =
        latest.totalCases >= 40
          ? 'healthy'
          : latest.totalCases >= 20
            ? 'warning'
            : 'critical'
      break
    case 'freshness': {
      label = 'Freshness'
      const iso = suite.lastUpdated
      if (!iso) {
        value = '—'
        state = 'critical'
      } else {
        value = formatDistanceToNow(new Date(iso))
        const hours = (Date.now() - new Date(iso).getTime()) / HOUR
        state = hours >= 12 ? 'critical' : hours >= 7 ? 'warning' : 'healthy'
      }
      break
    }
  }

  return (
    <Card className={`h-full border ${stateBg(state)}`}>
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className={`text-xs font-medium ${stateColor(state)}`}>
            {stateLabel(state)}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{value}</span>
          {delta ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {delta}
            </span>
          ) : null}
        </div>
        {config.sparkline ? (
          <Sparkline trend={suite.trend} color="var(--chart-1)" />
        ) : null}
      </CardContent>
    </Card>
  )
}

function SystemHealthPill({
  data,
  config
}: {
  data: WidgetProps<Config>['data']
  config: Config
}) {
  const suite = data[config.suite]
  const latest = suite.latest
  if (!latest) {
    return (
      <Card className="border">
        <CardContent className="p-4 text-xs text-muted-foreground">
          No runs yet
        </CardContent>
      </Card>
    )
  }

  const alarms = computeFindings(data).filter(
    f => f.severity === 'drop' || f.severity === 'critical'
  ).length
  const previous = suite.previous
  const passDelta = formatDeltaPts(
    previous ? latest.passRate - previous.passRate : null
  )
  const lastRun = suite.lastUpdated
    ? formatDistanceToNow(new Date(suite.lastUpdated), { addSuffix: true })
    : '—'

  return (
    <Card className="h-full border">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <span className="inline-flex w-fit items-center rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-700 dark:text-sky-300">
          {alarms === 0
            ? 'All systems healthy'
            : `${alarms} alarm${alarms === 1 ? '' : 's'}`}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">
            {percent(latest.passRate)}
          </span>
          <span className="text-sm text-muted-foreground">pass</span>
          {passDelta ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {passDelta}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          last run {lastRun} · 5 KPIs rolled up
        </p>
      </CardContent>
    </Card>
  )
}
