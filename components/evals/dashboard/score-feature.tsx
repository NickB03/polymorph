'use client'

import { getSuiteDisplay } from '@/lib/evals/display'
import { DEFINITIONS, snapshotSuiteKey } from '@/lib/evals/glossary'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

import { getScoreStatus } from '@/components/evals/dashboard/score-bar'
import { pct } from '@/components/evals/dashboard/shared'
import { KpiStrip } from '@/components/evals/dashboard-v2/kpi-strip'
import { AggregateBreakdown, DefinedTerm } from '@/components/evals/glossary'

export function ScoreFeature({
  cap,
  previous,
  hideTagline = false
}: {
  cap: EvalSummarySnapshot
  previous: EvalSummarySnapshot | null
  hideTagline?: boolean
}) {
  const score = Math.max(0, Math.min(1, cap.overallScore))
  const r = 80
  const C = 2 * Math.PI * r
  const offset = C * (1 - score)
  const suiteKey = snapshotSuiteKey(cap)
  const suiteCopy = getSuiteDisplay(cap.suite)
  const definition = DEFINITIONS[suiteKey]

  const status = getScoreStatus({
    value: cap.overallScore,
    threshold: cap.threshold,
    failed: cap.thresholdBreached
  })
  const ringStroke =
    status === 'on-track'
      ? 'var(--accent-blue)'
      : status === 'near-threshold'
        ? 'var(--accent-amber)'
        : 'var(--destructive)'
  const valueColor =
    status === 'on-track'
      ? 'text-foreground'
      : status === 'near-threshold'
        ? 'text-accent-amber'
        : 'text-destructive'

  return (
    <section className="flex h-full flex-col gap-6">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">
            <DefinedTerm def={definition}>{suiteCopy.label}</DefinedTerm>
          </h2>
          <span className="text-xs italic text-muted-foreground">
            on demand
          </span>
        </div>
        {hideTagline ? null : (
          <p className="text-xs leading-snug text-muted-foreground">
            {suiteCopy.tagline}
          </p>
        )}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="relative mx-auto flex h-56 w-56 cursor-help appearance-none items-center justify-center border-0 bg-transparent p-0 font-[inherit] text-inherit transition-opacity hover:opacity-90"
          >
            <svg
              className="h-full w-full -rotate-90"
              viewBox="0 0 200 200"
              aria-label={`${suiteCopy.label} score: ${pct(score)}. Focus or hover for per-judge breakdown.`}
              role="img"
            >
              <circle
                cx="100"
                cy="100"
                r={r}
                stroke="currentColor"
                strokeWidth="10"
                className="text-border"
                fill="none"
              />
              <circle
                cx="100"
                cy="100"
                r={r}
                style={{ stroke: ringStroke }}
                strokeWidth="10"
                strokeDasharray={C}
                strokeDashoffset={offset}
                strokeLinecap="round"
                fill="none"
                className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={cn(
                  'font-mono text-5xl font-semibold tabular-nums',
                  valueColor
                )}
              >
                {pct(score)}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                aggregate
              </span>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          sideOffset={12}
          collisionPadding={16}
          className="max-w-xs space-y-2 text-xs leading-relaxed"
        >
          <AggregateBreakdown
            suiteLabel={suiteCopy.label}
            suite={suiteKey}
            snap={cap}
            score={score}
          />
        </TooltipContent>
      </Tooltip>

      <KpiStrip snap={cap} previous={previous} />

      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="truncate">
          Experiment <span className="font-mono">{cap.experimentName}</span>
        </p>
        <p className="truncate">
          Dataset <span className="font-mono">{cap.datasetName}</span>
        </p>
      </div>
    </section>
  )
}
