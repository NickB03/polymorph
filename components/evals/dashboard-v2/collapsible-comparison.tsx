'use client'

import { useState } from 'react'

import { ChevronDown, ChevronUp } from 'lucide-react'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { ComparisonTable } from '@/components/evals/dashboard/comparison-table'

export function CollapsibleComparison({
  cap,
  traf
}: {
  cap: EvalSummarySnapshot
  traf: EvalSummarySnapshot
}) {
  const [open, setOpen] = useState(true)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-background px-5 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="text-sm font-medium">
          Where curated and live diverge
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded={true}
        aria-label="Collapse comparison"
        className="absolute right-4 top-4 z-10 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        <ChevronUp className="size-4" />
      </button>
      <ComparisonTable cap={cap} traf={traf} />
    </div>
  )
}
