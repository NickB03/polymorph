'use client'

import { DEFINITIONS, snapshotSuiteKey } from '@/lib/evals/glossary'
import type { EvalSummarySnapshot } from '@/lib/evals/types'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

import { AggregateBreakdown, DefinedTerm } from '@/components/evals/glossary'

import { deltaPts, pct } from './shared'

export function ScoreFeature({
  cap,
  previous
}: {
  cap: EvalSummarySnapshot
  previous: EvalSummarySnapshot | null
}) {
  const score = Math.max(0, Math.min(1, cap.overallScore))
  const r = 80
  const C = 2 * Math.PI * r
  const offset = C * (1 - score)
  const delta = previous ? cap.overallScore - previous.overallScore : null
  const suiteKey = snapshotSuiteKey(cap)
  const label = 'Benchmarks'

  return (
    <section className="flex h-full flex-col gap-6">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">
            <DefinedTerm def={DEFINITIONS.benchmarks}>{label}</DefinedTerm>
          </h2>
          <span className="text-xs italic text-muted-foreground">
            on demand
          </span>
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          Curated test prompts · the model under controlled inputs.
        </p>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative mx-auto flex h-56 w-56 cursor-help items-center justify-center transition-opacity hover:opacity-90">
            <svg
              className="h-full w-full -rotate-90"
              viewBox="0 0 200 200"
              aria-label={`${label} score: ${pct(score)}. Hover for per-judge breakdown.`}
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
                style={{ stroke: 'var(--accent-blue)' }}
                strokeWidth="10"
                strokeDasharray={C}
                strokeDashoffset={offset}
                strokeLinecap="round"
                fill="none"
                className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-5xl font-semibold tabular-nums">
                {pct(score)}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                aggregate
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          sideOffset={12}
          collisionPadding={16}
          className="max-w-xs space-y-2 text-xs leading-relaxed"
        >
          <AggregateBreakdown
            suiteLabel={label}
            suite={suiteKey}
            snap={cap}
            score={score}
          />
        </TooltipContent>
      </Tooltip>

      <dl className="grid grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">Pass rate</dt>
          <dd className="font-mono text-sm font-medium tabular-nums">
            {pct(cap.passRate)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">Change · 48h</dt>
          <dd className="font-mono text-sm font-medium tabular-nums">
            {deltaPts(delta) ?? '—'}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">Cases</dt>
          <dd className="font-mono text-sm font-medium tabular-nums">
            {cap.totalCases}
          </dd>
        </div>
      </dl>

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
