'use client'

import { EVALUATOR_DISPLAY_ORDER } from '@/lib/evals/evaluator-labels'
import { snapshotSuiteKey } from '@/lib/evals/glossary'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { ScoreBar } from '@/components/evals/dashboard/score-bar'
import { pct } from '@/components/evals/dashboard/shared'
import { ScoreCell } from '@/components/evals/glossary'

import { AutoBadge } from './auto-badge'
import { localLabel } from './local-labels'

const DETERMINISTIC_KEYS = new Set(['deterministic_prechecks', 'tool_usage'])

export function EvaluatorBreakdown({ snap }: { snap: EvalSummarySnapshot }) {
  const failed = new Set(snap.failedEvaluators)
  const suiteKey = snapshotSuiteKey(snap)

  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl border border-border/60 bg-background p-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight">
          Evaluator breakdown
        </h3>
        <p className="text-xs leading-snug text-muted-foreground">
          One row per evaluator. Rows tagged <AutoBadge /> are deterministic
          rules that gate eligibility — the rest are LLM judges. Hover any row
          for the judge’s definition and threshold status.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
        {EVALUATOR_DISPLAY_ORDER.map(key => {
          const v = snap.evaluatorScores[key]
          if (v == null) return null
          const isAuto = DETERMINISTIC_KEYS.has(key)
          const isFailed = failed.has(key)
          return (
            <li key={key}>
              <ScoreCell
                suite={suiteKey}
                judgeKey={key}
                value={v}
                caseCount={snap.totalCases}
                threshold={snap.threshold}
                failed={isFailed}
              >
                <span className="-mx-2 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_44px] items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/40">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'truncate',
                        isFailed ? 'text-destructive' : 'text-foreground'
                      )}
                    >
                      {localLabel(key)}
                    </span>
                    {isAuto ? <AutoBadge /> : null}
                  </span>
                  <ScoreBar
                    failed={isFailed}
                    threshold={snap.threshold}
                    value={v}
                  />
                  <span
                    className={cn(
                      'text-right font-mono text-xs tabular-nums',
                      isFailed ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {pct(v)}
                  </span>
                </span>
              </ScoreCell>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <span>
          Experiment <span className="font-mono">{snap.experimentName}</span>
        </span>
        <span>
          Dataset <span className="font-mono">{snap.datasetName}</span>
        </span>
        {snap.phoenixUrl ? (
          <a
            href={snap.phoenixUrl}
            rel="noreferrer"
            target="_blank"
            className="ml-auto text-accent-blue underline-offset-4 hover:underline"
          >
            Inspect in Phoenix →
          </a>
        ) : null}
      </div>
    </section>
  )
}
