'use client'

import { type CSSProperties, useEffect } from 'react'

import { formatDistanceToNow } from 'date-fns'

import { getOverallStatus, type SuiteStatus } from '@/lib/evals/helpers/status'
import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ActivityList } from '@/components/evals/dashboard/activity-list'
import { ScoreFeature } from '@/components/evals/dashboard/score-feature'

import { getDefaultSuite, getPhoenixInsight } from './attention'
import { CollapsibleComparison } from './collapsible-comparison'
import { EvaluatorBreakdown } from './evaluator-breakdown'
import { PhoenixInsightStrip } from './phoenix-insight'
import { SuiteSelector } from './suite-selector'
import { isSuiteId, isView, type SuiteId, type View } from './url-state'
import { useUrlState } from './use-url-state'
import { getViewDescription, ViewSwitcher } from './view-switcher'

function enter(delayMs: number): CSSProperties {
  return { ['--enter-delay' as string]: `${delayMs}ms` }
}

export function EvalsDashboardV2({ data }: { data: EvalsDashboardData }) {
  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  const reg = data.regression.latest

  if (!cap && !traf && !reg) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
            <Header
              view="suites"
              onChange={() => {}}
              data={data}
              hideSwitcher
            />
            <p className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-12 text-center text-sm text-muted-foreground">
              No evaluation runs have landed yet. The next Production Evals cron
              will populate this page.
            </p>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return <DashboardWithViews data={data} />
}

function DashboardWithViews({ data }: { data: EvalsDashboardData }) {
  const [view, setView] = useUrlState('view', 'suites', isView)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
          <Header view={view} onChange={setView} data={data} />

          {view === 'suites' ? <SuitesView data={data} /> : null}
          {view === 'history' ? (
            <div
              className="motion-safe:animate-content-enter"
              style={enter(60)}
            >
              <ActivityList data={data} />
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  )
}

function Header({
  view,
  onChange,
  data,
  hideSwitcher = false
}: {
  view: View
  onChange: (next: View) => void
  data: EvalsDashboardData
  hideSwitcher?: boolean
}) {
  const lastSyncIso = data.trafficMonitor.lastUpdated
  const lastSync = lastSyncIso
    ? formatDistanceToNow(new Date(lastSyncIso), { addSuffix: true })
    : 'never'
  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  const reg = data.regression.latest
  const totalCases =
    (cap?.totalCases ?? 0) + (traf?.totalCases ?? 0) + (reg?.totalCases ?? 0)
  const overallStatus = getOverallStatus(data)

  return (
    <header
      className="space-y-3 border-b border-border/60 pb-6 motion-safe:animate-content-enter"
      style={enter(0)}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Evaluation</h1>
          <StatusPill status={overallStatus} />
        </div>
        {hideSwitcher ? null : (
          <ViewSwitcher value={view} onChange={onChange} />
        )}
      </div>
      <p className="text-base leading-relaxed text-muted-foreground">
        {getViewDescription(view)}{' '}
        <span className="font-mono tabular-nums text-foreground">
          {totalCases}
        </span>{' '}
        cases scored in the last 48h · last sync {lastSync}.
      </p>
    </header>
  )
}

const STATUS_PILL_STYLE: Record<SuiteStatus, string> = {
  READY: 'bg-success-bg text-success border-success-border',
  WATCH: 'bg-warning-bg text-warning border-warning-border',
  BLOCKED: 'bg-destructive/10 text-destructive border-destructive/30'
}

function StatusPill({ status }: { status: SuiteStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide',
        STATUS_PILL_STYLE[status]
      )}
      data-testid="overall-status-pill"
    >
      {status}
    </span>
  )
}

function SuitesView({ data }: { data: EvalsDashboardData }) {
  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  const reg = data.regression.latest
  const defaultSuite = getDefaultSuite(data)
  const insight = getPhoenixInsight(data)
  const previousMap: Record<SuiteId, EvalSummarySnapshot | null> = {
    capability: data.capability.previous,
    trafficMonitor: data.trafficMonitor.previous,
    regression: data.regression.previous
  }
  const snapMap: Record<SuiteId, EvalSummarySnapshot | null> = {
    capability: cap,
    trafficMonitor: traf,
    regression: reg
  }
  const [active, setActive] = useUrlState('suite', defaultSuite, isSuiteId)
  const selectedSuite = snapMap[active] ? active : defaultSuite
  const activeSnap = snapMap[selectedSuite]

  useEffect(() => {
    if (active !== selectedSuite) {
      setActive(selectedSuite)
    }
  }, [active, selectedSuite, setActive])

  return (
    <div
      className="space-y-10 motion-safe:animate-content-enter"
      style={enter(60)}
    >
      {insight ? (
        <PhoenixInsightStrip
          insight={insight}
          onReview={() => setActive(insight.suiteId)}
        />
      ) : null}

      <SuiteSelector
        active={selectedSuite}
        attentionSuite={insight?.suiteId ?? null}
        onChange={setActive}
        snaps={snapMap}
      />

      {activeSnap ? (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <ScoreFeature
              cap={activeSnap}
              previous={previousMap[selectedSuite]}
              hideTagline
            />
          </div>
          <div className="lg:col-span-8">
            <EvaluatorBreakdown
              snap={activeSnap}
              previous={previousMap[selectedSuite]}
            />
          </div>
        </div>
      ) : null}

      {cap && traf ? <CollapsibleComparison cap={cap} traf={traf} /> : null}
    </div>
  )
}
