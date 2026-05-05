import { ArrowRight, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

import { pct } from '@/components/evals/dashboard/shared'

import type { PhoenixInsight } from './attention'
import { localLabel } from './local-labels'

export function PhoenixInsightStrip({
  insight,
  onReview,
  className
}: {
  insight: PhoenixInsight
  onReview: () => void
  className?: string
}) {
  const failingJudges =
    insight.alert.failedEvaluators.length > 0
      ? insight.alert.failedEvaluators.map(localLabel).join(', ')
      : 'No specific judges listed'

  return (
    <section
      aria-labelledby="phoenix-insight-title"
      className={cn(
        'rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-sm',
        className
      )}
      data-testid="phoenix-insight"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles
              aria-hidden="true"
              className="size-4 shrink-0 text-warning"
            />
            <h2
              id="phoenix-insight-title"
              className="text-sm font-semibold text-foreground"
            >
              Phoenix insight
            </h2>
          </div>
          <p className="font-medium text-foreground">{insight.summary}</p>
          <p className="text-muted-foreground">{insight.interpretation}</p>
          <p className="text-xs text-muted-foreground">
            {pct(insight.alert.passRate)} pass rate ·{' '}
            {pct(insight.alert.threshold)} threshold · {failingJudges}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {insight.alert.phoenixUrl ? (
            <a
              href={insight.alert.phoenixUrl}
              rel="noreferrer"
              target="_blank"
              className="inline-flex h-9 items-center rounded-md px-3 text-xs font-medium text-warning underline-offset-4 hover:underline"
            >
              Open Phoenix
            </a>
          ) : null}
          <button
            type="button"
            onClick={onReview}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {insight.actionLabel}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  )
}
