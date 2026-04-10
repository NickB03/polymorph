import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { DeltaBadge } from './delta-badge'

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function ScoreRing({
  label,
  score,
  passRate,
  delta
}: {
  label: string
  score: number
  passRate: number
  delta?: number | null
}) {
  const clampedScore = Math.max(0, Math.min(score, 1))
  const radius = 72
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - clampedScore)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">{label}</CardTitle>
        <DeltaBadge delta={delta ?? null} />
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div
          className="relative flex h-52 w-52 items-center justify-center"
          data-testid="score-ring"
        >
          <svg
            className="h-full w-full -rotate-90"
            viewBox="0 0 180 180"
            role="progressbar"
            aria-valuenow={Math.round(clampedScore * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label} score: ${formatPercent(score)}`}
          >
            <circle
              cx="90"
              cy="90"
              r={radius}
              stroke="currentColor"
              strokeWidth="14"
              className="text-muted/40"
              fill="none"
            />
            <circle
              cx="90"
              cy="90"
              r={radius}
              stroke="currentColor"
              strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="text-primary transition-[stroke-dashoffset] duration-500"
              fill="none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-semibold tabular-nums">
              {formatPercent(score)}
            </span>
            <span className="mt-2 text-sm text-muted-foreground">{label}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Pass rate {formatPercent(passRate)}
        </p>
      </CardContent>
    </Card>
  )
}
