'use client'

import type { CSSProperties } from 'react'

import { formatDistanceToNow } from 'date-fns'

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ActivityList } from '@/components/evals/dashboard/activity-list'
import { ScoreFeature } from '@/components/evals/dashboard/score-feature'

import { CollapsibleComparison } from './collapsible-comparison'
import { CompactAlert } from './compact-alert'
import { EvaluatorBreakdown } from './evaluator-breakdown'
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
  const totalCases = (cap?.totalCases ?? 0) + (traf?.totalCases ?? 0)

  return (
    <header
      className="space-y-6 border-b border-border/60 pb-6 motion-safe:animate-content-enter"
      style={enter(0)}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Polymorph · Quality evals
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Response quality
          </h1>
        </div>
        {hideSwitcher ? null : (
          <ViewSwitcher value={view} onChange={onChange} />
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {getViewDescription(view)} {totalCases} cases scored in the last 48h ·
          last sync {lastSync}.
        </p>
      </div>
    </header>
  )
}

function SuitesView({ data }: { data: EvalsDashboardData }) {
  const [active, setActive] = useUrlState('suite', 'capability', isSuiteId)

  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  const reg = data.regression.latest

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
  const activeSnap = snapMap[active]

  return (
    <div
      className="space-y-10 motion-safe:animate-content-enter"
      style={enter(60)}
    >
      <CompactAlert data={data} />

      <SuiteSelector active={active} onChange={setActive} snaps={snapMap} />

      {activeSnap ? (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <ScoreFeature
              cap={activeSnap}
              previous={previousMap[active]}
              hideTagline
            />
          </div>
          <div className="lg:col-span-8">
            <EvaluatorBreakdown snap={activeSnap} />
          </div>
        </div>
      ) : null}

      {cap && traf ? <CollapsibleComparison cap={cap} traf={traf} /> : null}
    </div>
  )
}
