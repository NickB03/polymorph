'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'

import { ComparisonTable } from '@/components/evals/dashboard/comparison-table'

export function CollapsibleComparison({
  cap,
  traf
}: {
  cap: EvalSummarySnapshot
  traf: EvalSummarySnapshot
}) {
  return (
    <Collapsible defaultOpen className="group">
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-5 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background group-data-[state=open]:hidden">
        <span className="text-sm font-medium">
          Where test and production diverge
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="relative">
          <CollapsibleTrigger
            aria-label="Collapse comparison"
            className="absolute right-4 top-4 z-10 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ChevronUp className="size-4" />
          </CollapsibleTrigger>
          <ComparisonTable cap={cap} traf={traf} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
