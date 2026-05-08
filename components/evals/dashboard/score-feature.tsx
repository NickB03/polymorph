'use client'

import { getSuiteDisplay } from '@/lib/evals/display'
import { DEFINITIONS, snapshotSuiteKey } from '@/lib/evals/glossary'
import { getSuiteStatus } from '@/lib/evals/helpers/status'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

import { getScoreStatus } from '@/components/evals/dashboard/score-bar'
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

  const thresholdGap =
    cap.threshold == null ? null : (cap.overallScore - cap.threshold) * 100
  const belowThresholdLabel =
    thresholdGap != null && thresholdGap < 0
      ? `Below threshold by ${Math.abs(Math.round(thresholdGap))} points`
      : null
  const suiteStatus = getSuiteStatus(cap, previous)
  const belowThresholdColor =
    suiteStatus === 'BLOCKED' ? 'text-destructive' : 'text-accent-amber'

  return (
    <section className="flex h-full flex-col gap-5 rounded-2xl border border-border/60 bg-background p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active suite
          </span>
          <h2 className="text-base font-semibold tracking-tight">
            <DefinedTerm def={definition}>{suiteCopy.label}</DefinedTerm>
          </h2>
        </div>
      </div>
      {hideTagline ? null : (
        <p className="-mt-3 text-xs leading-snug text-muted-foreground">
          {suiteCopy.tagline}
        </p>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="relative mx-auto flex h-60 w-60 cursor-help appearance-none items-center justify-center border-0 bg-transparent p-0 font-[inherit] text-inherit transition-opacity hover:opacity-90"
          >
            <svg
              className="h-full w-full -rotate-90"
              viewBox="0 0 200 200"
              aria-label={`${suiteCopy.label} score: ${score.toFixed(2)}. Focus or hover for per-judge breakdown.`}
              role="img"
            >
              <circle
                cx="100"
                cy="100"
                r={r}
                stroke="currentColor"
                strokeWidth="22"
                className="text-muted"
                fill="none"
              />
              <circle
                cx="100"
                cy="100"
                r={r}
                style={{ stroke: ringStroke }}
                strokeWidth="22"
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
                {score.toFixed(2)}
              </span>
              {cap.threshold != null ? (
                <span className="mt-1 text-xs text-muted-foreground">
                  vs threshold {cap.threshold.toFixed(2)}
                </span>
              ) : (
                <span className="mt-1 text-xs text-muted-foreground">
                  aggregate
                </span>
              )}
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

      {belowThresholdLabel ? (
        <p
          className={cn(
            '-mt-3 text-center text-xs font-medium',
            belowThresholdColor
          )}
        >
          {belowThresholdLabel}
        </p>
      ) : null}

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
