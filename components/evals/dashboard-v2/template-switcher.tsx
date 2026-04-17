'use client'

import {
  Activity,
  GitCompareArrows,
  HeartPulse,
  type LucideIcon
} from 'lucide-react'

import { TEMPLATES } from '@/lib/evals/layout/templates'
import type { TemplateId } from '@/lib/evals/layout/types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

const LABELS: Record<TemplateId, string> = {
  a: 'Health',
  b: 'Compare',
  c: 'Activity'
}

const ICONS: Record<TemplateId, LucideIcon> = {
  a: HeartPulse,
  b: GitCompareArrows,
  c: Activity
}

export function TemplateSwitcher({
  value,
  onChange,
  pending = false
}: {
  value: TemplateId
  onChange: (next: TemplateId) => void
  pending?: boolean
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="radiogroup"
        aria-label="Evals layout"
        data-pending={pending || undefined}
        className={cn(
          'flex w-full items-center gap-0.5 rounded-full border border-border bg-background p-0.5',
          'sm:inline-flex sm:w-auto',
          'data-[pending]:pointer-events-none data-[pending]:opacity-80'
        )}
      >
        {TEMPLATES.map(t => {
          const active = t.id === value
          const Icon = ICONS[t.id]
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  variant="ghost"
                  size="sm"
                  onClick={() => !active && onChange(t.id)}
                  className={cn(
                    'h-11 flex-1 gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                    'sm:h-7 sm:flex-none',
                    active
                      ? 'bg-accent-blue/10 text-accent-blue shadow-xs hover:bg-accent-blue/15'
                      : 'text-muted-foreground hover:bg-muted/60'
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {LABELS[t.id]}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t.description}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
