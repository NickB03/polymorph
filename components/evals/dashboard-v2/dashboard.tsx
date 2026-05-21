'use client'

import { type CSSProperties, useEffect } from 'react'

import { formatDistanceToNow } from 'date-fns'

import {
  getOverallStatus,
  getSuiteStatus,
  STATUS_TOKENS,
  type SuiteStatus
} from '@/lib/evals/helpers/status'
import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ActivityList } from '@/components/evals/dashboard/activity-list'
import { ScoreFeature } from '@/components/evals/dashboard/score-feature'

import { getDefaultSuite } from './attention'
import { CollapsibleComparison } from './collapsible-comparison'
import { EvaluatorBreakdown } from './evaluator-breakdown'
import { KpiStrip } from './kpi-strip'
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
        <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-10 pt-14 sm:px-8 sm:pt-8 lg:px-12">
            <Header
              view="suites"
              onChange={() => {}}
              data={data}
              hideSwitcher
            />
            <p className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
              No evaluation runs have landed yet. The next Traffic Monitor cron
              will populate this page.
            </p>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return <DashboardWithViews data={data} />
}

function getLastSyncText(data: EvalsDashboardData): string {
  const lastSyncIso = data.trafficMonitor.lastUpdated
  return lastSyncIso
    ? formatDistanceToNow(new Date(lastSyncIso), { addSuffix: true })
    : 'never'
}

function DashboardWithViews({ data }: { data: EvalsDashboardData }) {
  const [view, setView] = useUrlState('view', 'suites', isView)
  const defaultSuite = getDefaultSuite(data)
  const [activeSuite, setActiveSuite] = useUrlState(
    'suite',
    defaultSuite,
    isSuiteId
  )

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-10 pt-14 sm:px-8 sm:pt-8 lg:px-12">
          <Header view={view} onChange={setView} data={data} />

          {view === 'suites' ? (
            <SuitesView
              data={data}
              active={activeSuite}
              setActive={setActiveSuite}
            />
          ) : null}
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
  const lastSync = getLastSyncText(data)
  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  const reg = data.regression.latest
  const totalCases =
    (cap?.totalCases ?? 0) + (traf?.totalCases ?? 0) + (reg?.totalCases ?? 0)
  const overallStatus = getOverallStatus(data)

  return (
    <header
      className="space-y-3 border-b border-border pb-6 motion-safe:animate-content-enter"
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
        {getViewDescription(view)} ·{' '}
        <span className="font-mono tabular-nums text-foreground">
          {totalCases}
        </span>{' '}
        cases scored · in last 48h · last sync {lastSync}
      </p>
    </header>
  )
}

function StatusPill({ status }: { status: SuiteStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide',
        STATUS_TOKENS[status].pill
      )}
      data-testid="overall-status-pill"
    >
      {status}
    </span>
  )
}

function SuitesView({
  data,
  active,
  setActive
}: {
  data: EvalsDashboardData
  active: SuiteId
  setActive: (next: SuiteId) => void
}) {
  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  const reg = data.regression.latest
  const defaultSuite = getDefaultSuite(data)
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
  const selectedSuite = snapMap[active] ? active : defaultSuite
  const activeSnap = snapMap[selectedSuite]

  useEffect(() => {
    if (active !== selectedSuite) {
      setActive(selectedSuite)
    }
  }, [active, selectedSuite, setActive])

  return (
    <div
      className="space-y-8 motion-safe:animate-content-enter"
      style={enter(60)}
    >
      <SuiteSelector
        active={selectedSuite}
        onChange={setActive}
        snaps={snapMap}
        previous={previousMap}
      />

      {activeSnap ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <ScoreFeature
              cap={activeSnap}
              previous={previousMap[selectedSuite]}
              hideTagline
              footer={
                <KpiStrip
                  snap={activeSnap}
                  previous={previousMap[selectedSuite]}
                />
              }
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
