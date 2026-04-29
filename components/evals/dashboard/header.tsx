'use client'

import { useState } from 'react'

import { formatDistanceToNow } from 'date-fns'

import type { EvalsDashboardData } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

export function DashboardHeader({ data }: { data: EvalsDashboardData }) {
  const lastSyncIso = data.trafficMonitor.lastUpdated
  const lastSync = lastSyncIso
    ? formatDistanceToNow(new Date(lastSyncIso), { addSuffix: true })
    : 'never'

  return (
    <header className="space-y-6 border-b border-border/60 pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Polymorph · Quality evals
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Response quality
          </h1>
        </div>
        <ViewSwitcher />
      </div>
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Seven automated judges grade every model response on faithfulness,
          relevance, safety, and four other criteria. This page tracks how
          scores trend across curated test prompts and live user traffic. Hover
          anything underlined to learn what it means.
        </p>
        <p className="text-xs text-muted-foreground">Last sync {lastSync}.</p>
      </div>
    </header>
  )
}

// Visual-only placeholder. The active tab does not yet control page content.
function ViewSwitcher() {
  const [active, setActive] = useState<'glance' | 'sidebyside' | 'history'>(
    'glance'
  )
  const items = [
    { id: 'glance' as const, label: 'At a glance' },
    { id: 'sidebyside' as const, label: 'Curated vs live' },
    { id: 'history' as const, label: 'Run history' }
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Dashboard layout"
      className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-border bg-background p-1 shadow-xs"
    >
      {items.map(it => {
        const on = active === it.id
        return (
          <button
            key={it.id}
            role="radio"
            aria-checked={on}
            type="button"
            onClick={() => setActive(it.id)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              on
                ? 'bg-accent-blue/10 text-accent-blue'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
