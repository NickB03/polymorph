'use client'

import type { CSSProperties, ReactNode } from 'react'

import type { EvalsDashboardData } from '@/lib/evals/types'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ActivityList } from '@/components/evals/dashboard/activity-list'
import { CombinedTrend } from '@/components/evals/dashboard/combined-trend'
import { ComparisonTable } from '@/components/evals/dashboard/comparison-table'
import { DashboardHeader } from '@/components/evals/dashboard/header'
import { KpiStrip } from '@/components/evals/dashboard/kpi-strip'
import { ScoreFeature } from '@/components/evals/dashboard/score-feature'
import { AlertBanner } from '@/components/evals/widgets/alert-banner'

function enter(delayMs: number): CSSProperties {
  return { ['--enter-delay' as string]: `${delayMs}ms` }
}

export function EvalsDashboardV2({
  data,
  footer
}: {
  data: EvalsDashboardData
  footer?: ReactNode
}) {
  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  const reg = data.regression.latest

  if (!cap && !traf && !reg) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
            <DashboardHeader data={data} />
            <p className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-12 text-center text-sm text-muted-foreground">
              No evaluation runs have landed yet. The next Traffic Monitor cron
              will populate this page.
            </p>
            {footer}
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
          <AlertBanner data={data} />

          <div className="motion-safe:animate-content-enter" style={enter(0)}>
            <DashboardHeader data={data} />
          </div>

          <div className="motion-safe:animate-content-enter" style={enter(60)}>
            <KpiStrip data={data} />
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {cap ? (
              <div
                className="motion-safe:animate-content-enter lg:col-span-4"
                style={enter(120)}
              >
                <ScoreFeature cap={cap} previous={data.capability.previous} />
              </div>
            ) : null}

            <div
              className="motion-safe:animate-content-enter lg:col-span-8"
              style={enter(180)}
            >
              <CombinedTrend
                capability={data.capability.trend}
                traffic={data.trafficMonitor.trend}
                regression={data.regression.trend}
              />
            </div>
          </div>

          {cap && traf ? (
            <div
              className="motion-safe:animate-content-enter"
              style={enter(240)}
            >
              <ComparisonTable cap={cap} traf={traf} />
            </div>
          ) : null}

          <div className="motion-safe:animate-content-enter" style={enter(300)}>
            <ActivityList data={data} />
          </div>

          {footer}
        </div>
      </div>
    </TooltipProvider>
  )
}
