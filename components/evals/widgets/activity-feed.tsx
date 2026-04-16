'use client'

import { useState } from 'react'

import { format } from 'date-fns'
import { History } from 'lucide-react'

import {
  getEvaluatorColor,
  getEvaluatorLabel
} from '@/lib/evals/evaluator-labels'
import {
  buildFeed,
  type FeedRow,
  type FeedRowId
} from '@/lib/evals/helpers/feed'
import { computeFindings } from '@/lib/evals/helpers/findings'
import type { HealthState } from '@/lib/evals/helpers/health-state'
import { stateColor } from '@/lib/evals/helpers/health-state'
import type { EvalsDashboardData } from '@/lib/evals/types'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { fmtDeltaPts, percent } from './shared/format'
import type { WidgetProps } from './shared/widget-props'

type Config = {
  expandedByDefault?: string | null
}

function deltaState(delta: number | null): HealthState {
  if (delta == null) return 'healthy'
  if (delta < -0.02) return 'critical'
  if (delta < 0) return 'warning'
  return 'healthy'
}

function resolveDefaultExpanded(
  data: EvalsDashboardData,
  feed: FeedRow[],
  sentinel: string | null | undefined
): FeedRowId | null {
  if (!sentinel) return null
  if (sentinel === 'worst-drop-or-latest') {
    const drop = computeFindings(data).find(f => f.severity === 'drop')
    if (drop) {
      const dropRow = feed.find(r => r.snapshot.id === drop.snapshotId)
      if (dropRow) return dropRow.id
    }
    return feed[0]?.id ?? null
  }
  const literal = feed.find(r => r.id === sentinel)
  return literal?.id ?? null
}

function FeedRowCard({
  row,
  expanded,
  onToggle
}: {
  row: FeedRow
  expanded: boolean
  onToggle: () => void
}) {
  const state = deltaState(row.overallDelta)
  return (
    <Card data-feed-row-id={row.id} data-expanded={expanded ? 'true' : 'false'}>
      <button type="button" onClick={onToggle} className="w-full text-left">
        <CardContent className="flex items-center gap-4 p-4">
          <Badge
            variant={row.suite === 'trafficMonitor' ? 'default' : 'outline'}
            className="w-32 justify-center"
          >
            {row.suiteLabel}
          </Badge>
          <span className="w-28 text-xs text-muted-foreground">
            {format(new Date(row.createdAt), 'MMM d, HH:mm')}
          </span>
          <span className="w-20 text-right text-sm font-semibold tabular-nums">
            {percent(row.overallScore)}
          </span>
          <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
            pass {percent(row.passRate)}
          </span>
          <span
            className={`w-20 text-right text-xs font-medium tabular-nums ${stateColor(state)}`}
          >
            {fmtDeltaPts(row.overallDelta) ?? '—'}
          </span>
          {row.snapshot.phoenixUrl ? (
            <a
              href={row.snapshot.phoenixUrl}
              rel="noreferrer"
              target="_blank"
              className="ml-auto text-xs text-primary underline underline-offset-4"
              onClick={e => e.stopPropagation()}
            >
              Phoenix →
            </a>
          ) : (
            <span className="ml-auto" />
          )}
          <span className="text-muted-foreground">{expanded ? '▾' : '▸'}</span>
        </CardContent>
      </button>
      {expanded ? (
        <CardContent className="space-y-3 border-t bg-muted/20 pt-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {Object.entries(row.snapshot.evaluatorScores).map(
              ([key, value]) => (
                <div key={key} className="flex items-center gap-3 text-xs">
                  <span className="w-32 truncate text-muted-foreground">
                    {getEvaluatorLabel(key)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${value * 100}%`,
                        backgroundColor: getEvaluatorColor(key)
                      }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums">
                    {percent(value)}
                  </span>
                </div>
              )
            )}
          </div>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <span>dataset: {row.snapshot.datasetName}</span>
            <span>cases: {row.snapshot.totalCases}</span>
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function ActivityFeed({ data, config }: WidgetProps<Config>) {
  const feed = buildFeed(data)
  const initial = resolveDefaultExpanded(data, feed, config.expandedByDefault)
  const [expandedId, setExpandedId] = useState<string | null>(initial)
  if (feed.length === 0) {
    return (
      <Card className="flex h-full flex-col border-dashed bg-muted/10">
        <CardHeader>
          <CardTitle className="text-sm">Activity feed</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="rounded-full border border-dashed border-muted-foreground/30 p-3 text-muted-foreground">
            <History aria-hidden className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No runs yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              As eval runs land in Postgres, they&apos;ll stream in here
              newest-first. The next Traffic Monitor run is scheduled every 6h.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="space-y-2">
      {feed.map(row => (
        <FeedRowCard
          key={row.id}
          row={row}
          expanded={expandedId === row.id}
          onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
        />
      ))}
    </div>
  )
}
