import { format } from 'date-fns'
import { TriangleAlert } from 'lucide-react'

import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import { getLatestThresholdAlert } from '@/lib/evals/helpers/alerts'
import type { EvalsDashboardData } from '@/lib/evals/types'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

function formatEvaluators(failedEvaluators: string[]) {
  if (failedEvaluators.length === 0) {
    return 'No passing judge scores were recorded.'
  }

  return failedEvaluators.map(getEvaluatorLabel).join(', ')
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function AlertBanner({ data }: { data: EvalsDashboardData }) {
  const alert = getLatestThresholdAlert(data)

  if (!alert) {
    return null
  }

  return (
    <Card
      data-testid="eval-alert-banner"
      className="border-rose-500/40 bg-rose-500/5"
    >
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-rose-600" />
            <Badge variant="destructive">{alert.suiteLabel} alert</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {alert.suiteLabel} fell below its recorded threshold.
            </p>
            <p className="text-sm text-muted-foreground">
              Pass rate {formatPercent(alert.passRate)} against a{' '}
              {formatPercent(alert.threshold)} threshold. Failing judges:{' '}
              {formatEvaluators(alert.failedEvaluators)}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(alert.createdAt), 'MMM d, HH:mm')} ·{' '}
              {alert.totalCases} cases · dataset {alert.datasetName}
            </p>
          </div>
        </div>
        {alert.phoenixUrl ? (
          <a
            href={alert.phoenixUrl}
            rel="noreferrer"
            target="_blank"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Open Phoenix
          </a>
        ) : null}
      </CardContent>
    </Card>
  )
}
