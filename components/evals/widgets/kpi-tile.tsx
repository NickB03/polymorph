import { useSyncExternalStore } from 'react'

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

import { fmtDeltaPts, percent } from './shared/format'
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

const METRIC_LABELS: Record<Metric, string> = {
  systemHealth: 'System Health',
  passRate: 'Pass Rate',
  overallScore: 'Overall Score',
  sampleCount: 'Samples',
  freshness: 'Freshness'
}

const HOUR = 60 * 60 * 1000

// Subscribe-once store: reads Date.now() only outside of render. Server
// snapshot is 0 so SSR and first client paint agree on a placeholder; the
// subscriber fires once on mount to record the real time.
function subscribeNow(onStoreChange: () => void) {
  onStoreChange()
  return () => {}
}
function getServerNow() {
  return 0
}

export function KpiTile({ data, config, breakpoint }: WidgetProps<Config>) {
  const nowMs = useSyncExternalStore(
    subscribeNow,
    () => Date.now(),
    getServerNow
  )

  if (breakpoint === 'sm' && config.metric === 'systemHealth') {
    return <SystemHealthPill data={data} config={config} />
  }

  const suite = data[config.suite]
  const latest = suite.latest
  if (!latest) {
    const suiteLabel =
      config.suite === 'capability' ? 'Capability' : 'Traffic Monitor'
    return (
      <Card className="h-full border border-dashed bg-muted/10">
        <CardContent className="flex h-full flex-col justify-between gap-2 p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {METRIC_LABELS[config.metric]}
          </span>
          <span className="text-3xl font-semibold tabular-nums text-muted-foreground/60">
            —
          </span>
          <span className="text-[11px] text-muted-foreground/70">
            {suiteLabel} has no runs yet
          </span>
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
      delta = fmtDeltaPts(previous ? latest.passRate - previous.passRate : null)
      state = healthForScore(latest.passRate, 0.9, 0.8)
      break
    case 'overallScore':
      label = 'Overall Score'
      value = latest.overallScore.toFixed(2)
      delta = fmtDeltaPts(
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
      } else if (nowMs === 0) {
        // Pre-hydration: show placeholder until useSyncExternalStore commits.
        value = '—'
        state = 'healthy'
      } else {
        value = formatDistanceToNow(new Date(iso))
        const hours = (nowMs - new Date(iso).getTime()) / HOUR
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
    const suiteLabel =
      config.suite === 'capability' ? 'Capability' : 'Traffic Monitor'
    return (
      <Card className="h-full border border-dashed bg-muted/10">
        <CardContent className="flex h-full flex-col justify-center gap-2 p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            System Health
          </span>
          <span className="text-sm text-muted-foreground">
            {suiteLabel} has no runs yet
          </span>
        </CardContent>
      </Card>
    )
  }

  const alarms = computeFindings(data).filter(
    f => f.severity === 'drop' || f.severity === 'critical'
  ).length
  const previous = suite.previous
  const passDelta = fmtDeltaPts(
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
