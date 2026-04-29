'use client'

import { useMemo } from 'react'

import { format } from 'date-fns'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { DEFINITIONS } from '@/lib/evals/glossary'
import { buildCombinedTrendFromSeries } from '@/lib/evals/helpers/combined-trend'
import type { EvalTrendPoint } from '@/lib/evals/types'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'

import { DefinedTerm } from '@/components/evals/glossary'

const HOUR_MS = 60 * 60 * 1000
const SHORT_AXIS_SPAN_MS = 3 * 24 * HOUR_MS

const SUITE_LABELS: Record<string, string> = {
  capability: 'Benchmarks',
  regression: 'Pinned checks',
  trafficMonitor: 'Traffic'
}

export function CombinedTrend({
  capability,
  traffic,
  regression
}: {
  capability: EvalTrendPoint[]
  traffic: EvalTrendPoint[]
  regression: EvalTrendPoint[]
}) {
  const series = useMemo(
    () =>
      buildCombinedTrendFromSeries({
        capability,
        regression,
        trafficMonitor: traffic
      }).map(point => ({
        ...point,
        timestamp: new Date(point.createdAt).getTime()
      })),
    [capability, traffic, regression]
  )
  const timeSpanMs =
    series.length > 1
      ? series[series.length - 1].timestamp - series[0].timestamp
      : 0
  const axisFormat = timeSpanMs <= SHORT_AXIS_SPAN_MS ? 'MMM d, ha' : 'MMM d'

  return (
    <section className="flex h-full flex-col gap-5 rounded-2xl border border-border/60 bg-background p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            <DefinedTerm def={DEFINITIONS.aggregateScore}>
              Aggregate score
            </DefinedTerm>{' '}
            · 14d
          </h2>
          <p className="text-xs leading-snug text-muted-foreground">
            One line per suite. Higher is better.
          </p>
        </div>
        <Legend
          items={[
            {
              label: 'Benchmarks — curated tests',
              color: 'var(--accent-blue)',
              def: DEFINITIONS.benchmarks,
              solid: true
            },
            {
              label: 'Pinned checks — known-risk cases',
              color: 'var(--muted-foreground)',
              def: DEFINITIONS.regression,
              dashed: true
            },
            {
              label: 'Traffic — live users',
              color: 'var(--accent-amber)',
              def: DEFINITIONS.trafficMonitor,
              dotted: true
            }
          ]}
        />
      </div>
      <ChartContainer
        config={{
          capability: { label: 'Benchmarks', color: 'var(--accent-blue)' },
          regression: {
            label: 'Pinned checks',
            color: 'var(--muted-foreground)'
          },
          trafficMonitor: { label: 'Traffic', color: 'var(--accent-amber)' }
        }}
        className="h-[260px] w-full"
      >
        <AreaChart data={series}>
          <defs>
            <linearGradient id="capFillCombined" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--accent-blue)"
                stopOpacity={0.18}
              />
              <stop
                offset="100%"
                stopColor="var(--accent-blue)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={[
              (dataMin: number) =>
                series.length > 1 ? dataMin : dataMin - HOUR_MS,
              (dataMax: number) =>
                series.length > 1 ? dataMax : dataMax + HOUR_MS
            ]}
            tickFormatter={v => format(new Date(Number(v)), axisFormat)}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={v => `${Math.round(Number(v) * 100)}`}
            tickLine={false}
            axisLine={false}
            width={32}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(_value, name) => (
                  <>
                    <span className="text-muted-foreground">
                      {SUITE_LABELS[String(name)] ?? String(name)}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {Math.round(Number(_value) * 100)}%
                    </span>
                  </>
                )}
                labelFormatter={(_value, payload) => {
                  const createdAt = payload?.find(
                    item => item?.payload?.createdAt
                  )?.payload.createdAt
                  return createdAt
                    ? format(new Date(createdAt), 'MMM d, h:mm a')
                    : null
                }}
                indicator="line"
                className="min-w-[10rem]"
              />
            }
          />
          <Area
            type="monotone"
            dataKey="capability"
            stroke="var(--accent-blue)"
            strokeWidth={2}
            fill="url(#capFillCombined)"
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="regression"
            stroke="var(--muted-foreground)"
            strokeOpacity={0.7}
            strokeWidth={1.5}
            strokeDasharray="3 4"
            fill="none"
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="trafficMonitor"
            stroke="var(--accent-amber)"
            strokeWidth={1.5}
            strokeDasharray="1 4"
            fill="none"
            connectNulls
          />
        </AreaChart>
      </ChartContainer>
    </section>
  )
}

function Legend({
  items
}: {
  items: Array<{
    label: string
    color: string
    def?: string
    solid?: boolean
    dashed?: boolean
    dotted?: boolean
  }>
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {items.map(it => {
        const swatch = (
          <span
            aria-hidden
            className="inline-block h-px w-5"
            style={{
              borderTop: `${
                it.dotted
                  ? '1.5px dotted'
                  : it.dashed
                    ? '1.5px dashed'
                    : '2px solid'
              } ${it.color}`
            }}
          />
        )
        const labelEl = it.def ? (
          <DefinedTerm def={it.def}>{it.label}</DefinedTerm>
        ) : (
          <span>{it.label}</span>
        )
        return (
          <span key={it.label} className="inline-flex items-center gap-1.5">
            {swatch}
            {labelEl}
          </span>
        )
      })}
    </div>
  )
}
