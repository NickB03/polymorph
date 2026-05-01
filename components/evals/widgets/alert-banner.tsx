import { TriangleAlert } from 'lucide-react'

import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import { getLatestThresholdAlert } from '@/lib/evals/helpers/alerts'
import type { EvalsDashboardData } from '@/lib/evals/types'

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function AlertBanner({ data }: { data: EvalsDashboardData }) {
  const alert = getLatestThresholdAlert(data)
  if (!alert) return null

  const failingJudges =
    alert.failedEvaluators.length > 0
      ? alert.failedEvaluators.map(getEvaluatorLabel).join(', ')
      : null

  return (
    <div
      data-testid="eval-alert-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-sm"
    >
      <TriangleAlert className="size-4 shrink-0 text-rose-600" />
      <span className="font-medium">{alert.suiteLabel} below threshold</span>
      {failingJudges ? (
        <span className="text-muted-foreground">
          · {failingJudges} at {formatPercent(alert.passRate)} (threshold{' '}
          {formatPercent(alert.threshold)})
        </span>
      ) : (
        <span className="text-muted-foreground">
          · pass rate {formatPercent(alert.passRate)} (threshold{' '}
          {formatPercent(alert.threshold)})
        </span>
      )}
      {alert.phoenixUrl ? (
        <a
          href={alert.phoenixUrl}
          rel="noreferrer"
          target="_blank"
          className="ml-auto text-xs font-medium text-rose-400 underline-offset-4 hover:underline"
        >
          Open Phoenix →
        </a>
      ) : null}
    </div>
  )
}
