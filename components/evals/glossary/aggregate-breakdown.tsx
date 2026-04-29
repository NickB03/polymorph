'use client'

import {
  EVALUATOR_DISPLAY_ORDER,
  getEvaluatorLabel
} from '@/lib/evals/evaluator-labels'
import { getScoreInsight, type SuiteKey } from '@/lib/evals/glossary'
import type { EvalSummarySnapshot } from '@/lib/evals/types'

export function AggregateBreakdown({
  suiteLabel,
  suite,
  snap,
  score
}: {
  suiteLabel: string
  suite: SuiteKey
  snap: EvalSummarySnapshot
  score: number
}) {
  const judges: Array<{ key: string; label: string; value: number }> = []
  for (const key of EVALUATOR_DISPLAY_ORDER) {
    const value = snap.evaluatorScores[key]
    if (value == null) continue
    judges.push({ key, label: getEvaluatorLabel(key), value })
  }
  judges.sort((a, b) => b.value - a.value)

  const lowest = judges[judges.length - 1]
  const lowestInsight = lowest ? getScoreInsight(suite, lowest.key) : null

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-foreground">
          {suiteLabel} · {Math.round(score * 100)}% aggregate
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {snap.totalCases} cases · {judges.length} judges
        </span>
      </div>
      <ul className="space-y-1">
        {judges.map(j => (
          <li
            key={j.key}
            className="grid grid-cols-[40px_1fr] items-baseline gap-2"
          >
            <span
              className={[
                'font-mono font-medium tabular-nums',
                j.key === lowest?.key
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              ].join(' ')}
            >
              {Math.round(j.value * 100)}%
            </span>
            <span
              className={
                j.key === lowest?.key
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }
            >
              {j.label}
            </span>
          </li>
        ))}
      </ul>
      {lowest && lowestInsight && lowestInsight.total > 0 ? (
        <p className="border-t border-border/60 pt-2 text-muted-foreground">
          Biggest drag is{' '}
          <span className="font-medium text-foreground">{lowest.label}</span> (
          {Math.round(lowest.value * 100)}%) — {lowestInsight.passed}/
          {lowestInsight.total} cases passed
          {lowestInsight.failureModes && lowestInsight.failureModes[0]
            ? `; top miss: ${lowestInsight.failureModes[0].description.toLowerCase()}`
            : ''}
        </p>
      ) : null}
    </>
  )
}
