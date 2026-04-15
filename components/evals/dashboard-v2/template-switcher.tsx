'use client'

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

const SHORT_LABELS: Record<TemplateId, string> = {
  a: 'A · Health',
  b: 'B · Compare',
  c: 'C · Activity'
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
          'inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5',
          'data-[pending]:pointer-events-none data-[pending]:opacity-80'
        )}
      >
        {TEMPLATES.map(t => {
          const active = t.id === value
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  variant="outline"
                  size="sm"
                  onClick={() => !active && onChange(t.id)}
                  className={cn(
                    'h-7 border-0 px-3 text-xs font-medium transition-colors',
                    active
                      ? 'bg-accent-blue/10 text-accent-blue shadow-xs hover:bg-accent-blue/15'
                      : 'text-muted-foreground hover:bg-muted/60'
                  )}
                >
                  {SHORT_LABELS[t.id]}
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
