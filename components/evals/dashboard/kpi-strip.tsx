'use client'

import type { ReactNode } from 'react'

import { DEFINITIONS } from '@/lib/evals/glossary'
import type { EvalsDashboardData } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { DefinedTerm } from '@/components/evals/glossary'

import {
  deltaPts,
  pct,
  type Severity,
  severityForScore,
  severityText
} from './shared'

export function KpiStrip({ data }: { data: EvalsDashboardData }) {
  const cap = data.capability.latest
  const prev = data.capability.previous
  const traf = data.trafficMonitor.latest

  if (!cap || !prev || !traf) {
    return null
  }

  const overallSeverity: Severity = traf.thresholdBreached
    ? 'alarm'
    : severityForScore(cap.passRate, 0.9, 0.8)

  const statusLabel =
    overallSeverity === 'alarm'
      ? 'Alarm'
      : overallSeverity === 'watch'
        ? 'Watch'
        : 'Healthy'

  const statusHint = traf.thresholdBreached
    ? `Traffic Monitor below ${pct(traf.threshold ?? 0.85)} threshold`
    : 'No suites are below threshold'

  const tiles: Array<{
    labelNode: ReactNode
    value: string
    delta?: string | null
    severity?: Severity
    hint?: string
    isText?: boolean
  }> = [
    {
      labelNode: <DefinedTerm def={DEFINITIONS.status}>Status</DefinedTerm>,
      value: statusLabel,
      severity: overallSeverity,
      hint: statusHint,
      isText: true
    },
    {
      labelNode: (
        <span>
          <DefinedTerm def={DEFINITIONS.passRate}>Pass rate</DefinedTerm>
          {' · curated'}
        </span>
      ),
      value: pct(cap.passRate),
      delta: deltaPts(cap.passRate - prev.passRate),
      severity: 'ok',
      hint: `Across the last ${cap.totalCases} cases`
    },
    {
      labelNode: (
        <DefinedTerm def={DEFINITIONS.aggregateScore}>
          Aggregate score
        </DefinedTerm>
      ),
      value: cap.overallScore.toFixed(2),
      delta: deltaPts(cap.overallScore - prev.overallScore),
      severity: severityForScore(cap.overallScore, 0.85, 0.7),
      hint: '0–1 scale · higher is better'
    },
    {
      labelNode: <span>Cases scored · 48h</span>,
      value: String(cap.totalCases + traf.totalCases),
      severity: 'ok',
      hint: `${cap.totalCases} curated · ${traf.totalCases} live`
    }
  ]

  return (
    <section
      aria-label="Status overview"
      className="grid grid-cols-2 gap-y-6 lg:grid-cols-4 lg:divide-x lg:divide-border/60"
    >
      {tiles.map((t, i) => (
        <div
          key={i}
          className={cn(
            'flex flex-col gap-2',
            i === 0 ? 'lg:pr-8' : 'lg:px-8',
            i === tiles.length - 1 && 'lg:pl-8 lg:pr-0'
          )}
        >
          <span className="text-xs font-medium text-muted-foreground">
            {t.labelNode}
          </span>
          <div className="flex items-baseline gap-3">
            <span
              className={cn(
                t.isText
                  ? 'font-semibold tracking-tight text-3xl sm:text-4xl'
                  : 'font-mono font-semibold tabular-nums text-4xl sm:text-[2.75rem]',
                severityText(t.severity ?? 'ok')
              )}
            >
              {t.value}
            </span>
            {t.delta ? (
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {t.delta}
              </span>
            ) : null}
          </div>
          {t.hint ? (
            <span className="text-xs leading-snug text-muted-foreground">
              {t.hint}
            </span>
          ) : null}
        </div>
      ))}
    </section>
  )
}
