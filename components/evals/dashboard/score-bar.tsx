import { cn } from '@/lib/utils'

export type ScoreBarStatus = 'on-track' | 'near-threshold' | 'below-threshold'

const STATUS_FILL_CLASS: Record<ScoreBarStatus, string> = {
  'on-track': 'bg-success',
  'near-threshold': 'bg-warning',
  'below-threshold': 'bg-destructive'
}

export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(value, 1))
}

export function getScoreStatus({
  value,
  threshold,
  failed
}: {
  value: number
  threshold?: number | null
  failed?: boolean
}): ScoreBarStatus {
  const score = clampScore(value)
  if (failed === true) return 'below-threshold'

  if (threshold != null) {
    const guardrail = clampScore(threshold)
    if (score < guardrail) return 'below-threshold'
    if (score - guardrail <= 0.05) return 'near-threshold'
    return 'on-track'
  }

  if (score >= 0.85) return 'on-track'
  if (score >= 0.7) return 'near-threshold'
  return 'below-threshold'
}

export function getScoreStatusLabel(status: ScoreBarStatus) {
  switch (status) {
    case 'on-track':
      return 'On track'
    case 'near-threshold':
      return 'Near threshold'
    case 'below-threshold':
      return 'Below threshold'
  }
}

export function ScoreBar({
  value,
  threshold,
  failed,
  className
}: {
  value: number
  threshold?: number | null
  failed?: boolean
  className?: string
}) {
  const score = clampScore(value)
  const status = getScoreStatus({ value, threshold, failed })
  const clampedThreshold = threshold == null ? null : clampScore(threshold)

  return (
    <span
      aria-hidden="true"
      className={cn('relative h-3 min-w-0 flex-1', className)}
      data-score-status={status}
      data-testid="score-bar"
    >
      <span
        className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-muted"
        data-testid="score-bar-track"
      >
        <span
          className={cn(
            'block h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300',
            STATUS_FILL_CLASS[status]
          )}
          data-testid="score-bar-fill"
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </span>
      {clampedThreshold != null ? (
        <span
          className="pointer-events-none absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-foreground/80"
          data-testid="score-bar-threshold"
          style={{ left: `${Math.round(clampedThreshold * 100)}%` }}
        />
      ) : null}
    </span>
  )
}
