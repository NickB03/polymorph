'use client'

import {
  caseResultsForEvaluator,
  failureModeCounts
} from '@/lib/evals/diagnostics'
import { EVALUATOR_DISPLAY_ORDER } from '@/lib/evals/evaluator-labels'
import { DEFINITIONS } from '@/lib/evals/glossary'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { DefinedTerm, JudgeLabel, ScoreCell } from '@/components/evals/glossary'

import { ScoreBar } from './score-bar'
import { deltaPts, pct, type Severity, severityText } from './shared'

export function ComparisonTable({
  cap,
  traf
}: {
  cap: EvalSummarySnapshot
  traf: EvalSummarySnapshot
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            Where test and production diverge
          </h2>
          <p className="max-w-xl text-xs leading-snug text-muted-foreground">
            One row per judge. Bars show each judge&apos;s score for{' '}
            <DefinedTerm def={DEFINITIONS.benchmarks}>Test Suite</DefinedTerm>{' '}
            vs{' '}
            <DefinedTerm def={DEFINITIONS.trafficMonitor}>
              Traffic Monitor
            </DefinedTerm>
            . <DefinedTerm def={DEFINITIONS.delta}>Δ</DefinedTerm> flags judges
            where production underperforms the test suite by &gt;7 points.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_64px] items-center gap-4 border-b border-border bg-muted/30 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Judge</span>
          <span>Test Suite</span>
          <span>Traffic Monitor</span>
          <span className="text-right">Δ pts</span>
        </div>

        <ul className="divide-y divide-border">
          {EVALUATOR_DISPLAY_ORDER.map(key => {
            const c = cap.evaluatorScores[key]
            const t = traf.evaluatorScores[key]
            if (c == null || t == null) return null
            const delta = c - t
            const sev: Severity =
              delta >= 0.15 ? 'alarm' : delta >= 0.07 ? 'watch' : 'ok'

            return (
              <li
                key={key}
                className={cn(
                  'grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_64px] items-center gap-4 px-5 py-3 text-sm transition-colors',
                  sev === 'alarm' ? 'bg-destructive/5' : 'hover:bg-muted/40'
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <SeverityDot severity={sev} />
                  <span className="truncate">
                    <JudgeLabel judgeKey={key} />
                  </span>
                </div>
                <ScoreCell
                  suite="benchmarks"
                  judgeKey={key}
                  value={c}
                  caseCount={cap.totalCases}
                  threshold={cap.threshold}
                  failed={cap.failedEvaluators.includes(key)}
                  observedFailureModes={failureModeCounts(
                    caseResultsForEvaluator(cap, key)
                  )}
                >
                  <ScoreValue
                    failed={cap.failedEvaluators.includes(key)}
                    threshold={cap.threshold}
                    value={c}
                  />
                </ScoreCell>
                <ScoreCell
                  suite="trafficMonitor"
                  judgeKey={key}
                  value={t}
                  caseCount={traf.totalCases}
                  threshold={traf.threshold}
                  failed={traf.failedEvaluators.includes(key)}
                  observedFailureModes={failureModeCounts(
                    caseResultsForEvaluator(traf, key)
                  )}
                >
                  <ScoreValue
                    failed={traf.failedEvaluators.includes(key)}
                    threshold={traf.threshold}
                    value={t}
                  />
                </ScoreCell>
                <span
                  className={cn(
                    'text-right font-mono text-xs font-medium tabular-nums',
                    severityText(sev)
                  )}
                >
                  {deltaPts(-delta) ?? '·'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function SeverityDot({ severity }: { severity: Severity }) {
  const colorClass =
    severity === 'alarm'
      ? 'bg-destructive'
      : severity === 'watch'
        ? 'bg-warning'
        : 'bg-transparent'
  return (
    <span aria-hidden className={cn('size-1.5 rounded-full', colorClass)} />
  )
}

function ScoreValue({
  value,
  threshold,
  failed
}: {
  value: number
  threshold?: number | null
  failed?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ScoreBar failed={failed} threshold={threshold} value={value} />
      <span className="w-9 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {pct(value)}
      </span>
    </div>
  )
}
