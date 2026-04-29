import { computeFindings, type Finding } from '@/lib/evals/helpers/findings'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { WidgetProps } from './shared/widget-props'

type Config = {
  maxItems?: number
}

function borderFor(severity: Finding['severity']) {
  switch (severity) {
    case 'critical':
      return 'border-rose-500'
    case 'drop':
      return 'border-amber-500'
    case 'improvement':
      return 'border-emerald-500'
    case 'watch':
      return 'border-muted-foreground/40'
  }
}

export function WhatChangedCard({ data, config }: WidgetProps<Config>) {
  const findings = computeFindings(data)
  const max = config.maxItems ?? 6
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">What changed (since last run)</CardTitle>
      </CardHeader>
      <CardContent>
        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All stable — no deltas above threshold since the last run.
          </p>
        ) : (
          <ul className="space-y-2">
            {findings.slice(0, max).map(f => (
              <li
                key={`${f.snapshotId}:${f.text}`}
                className={`border-l-2 pl-3 text-sm ${borderFor(f.severity)}`}
              >
                {f.text}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
