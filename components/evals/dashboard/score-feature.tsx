'use client'

import { type ReactNode } from 'react'

import { getSuiteDisplay } from '@/lib/evals/display'
import { DEFINITIONS, snapshotSuiteKey } from '@/lib/evals/glossary'
import { getSuiteStatus, STATUS_TOKENS } from '@/lib/evals/helpers/status'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

import { AggregateBreakdown, DefinedTerm } from '@/components/evals/glossary'

import { pct } from './shared'

export function ScoreFeature({
  cap,
  previous,
  hideTagline = false,
  footer
}: {
  cap: EvalSummarySnapshot
  previous: EvalSummarySnapshot | null
  hideTagline?: boolean
  footer?: ReactNode
}) {
  const score = Math.max(0, Math.min(1, cap.overallScore))
  const r = 80
  const C = 2 * Math.PI * r
  const offset = C * (1 - score)
  const suiteKey = snapshotSuiteKey(cap)
  const suiteCopy = getSuiteDisplay(cap.suite)
  const definition = DEFINITIONS[suiteKey]

  const suiteStatus = getSuiteStatus(cap, previous)
  const tokens = STATUS_TOKENS[suiteStatus]
  const ringStroke = tokens.cssVar
  const valueColor = suiteStatus === 'READY' ? 'text-foreground' : tokens.fg

  const thresholdGap =
    cap.threshold == null ? null : (cap.overallScore - cap.threshold) * 100
  const isBelowThreshold = thresholdGap != null && thresholdGap < 0
  const belowThresholdColor =
    suiteStatus === 'BLOCKED' ? 'text-destructive' : 'text-warning'

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 p-5">
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
              className="relative mx-auto flex h-44 w-44 cursor-help appearance-none items-center justify-center border-0 bg-transparent p-0 font-[inherit] text-inherit transition-opacity hover:opacity-90"
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
                  strokeLinecap="butt"
                  fill="none"
                  className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={cn(
                    'font-mono text-4xl font-semibold tabular-nums',
                    valueColor
                  )}
                >
                  {pct(score)}
                </span>
                {cap.threshold == null ? (
                  <span className="mt-1 text-xs text-muted-foreground">
                    aggregate
                  </span>
                ) : isBelowThreshold ? (
                  <span
                    className={cn(
                      'mt-1 text-xs font-medium',
                      belowThresholdColor
                    )}
                  >
                    {Math.abs(Math.round(thresholdGap))} pts below{' '}
                    {pct(cap.threshold)}
                  </span>
                ) : (
                  <span className="mt-1 text-xs text-muted-foreground">
                    vs threshold {pct(cap.threshold)}
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
      </div>
      {footer ? <div className="px-5 pb-5 pt-2">{footer}</div> : null}
    </section>
  )
}
