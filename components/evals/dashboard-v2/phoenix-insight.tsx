import { AlertTriangle, ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { PhoenixInsight } from './attention'

type Severity = 'watch' | 'blocked'

const PALETTE: Record<
  Severity,
  { container: string; rail: string; icon: string; cta: string }
> = {
  watch: {
    container: 'border-warning-border bg-warning-bg',
    rail: 'bg-warning',
    icon: 'text-warning',
    cta: 'bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning'
  },
  blocked: {
    container: 'border-destructive bg-destructive/10',
    rail: 'bg-destructive',
    icon: 'text-destructive',
    cta: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive'
  }
}

export function PhoenixInsightStrip({
  insight,
  onReview,
  severity = 'watch',
  className
}: {
  insight: PhoenixInsight
  onReview: () => void
  severity?: Severity
  className?: string
}) {
  const palette = PALETTE[severity]

  return (
    <section
      aria-labelledby="phoenix-insight-title"
      className={cn(
        'relative overflow-hidden rounded-xl border py-3 pl-4 pr-4 text-sm',
        palette.container,
        className
      )}
      data-testid="phoenix-insight"
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-1', palette.rail)}
      />
      <div className="flex flex-col gap-3 pl-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle
              aria-hidden="true"
              data-testid="phoenix-alert-icon"
              className={cn('size-4 shrink-0', palette.icon)}
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
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReview}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              palette.cta
            )}
          >
            {insight.actionLabel}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  )
}
