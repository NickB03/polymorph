'use client'

import { cn } from '@/lib/utils'

import type { View } from './url-state'

const VIEWS: ReadonlyArray<{
  id: View
  label: string
  description: string
}> = [
  {
    id: 'suites',
    label: 'Suites',
    description: 'How each suite is scoring right now.'
  },
  {
    id: 'history',
    label: 'Run history',
    description: 'What changed and when.'
  }
]

export function getViewDescription(view: View): string {
  return VIEWS.find(v => v.id === view)?.description ?? ''
}

export function ViewSwitcher({
  value,
  onChange
}: {
  value: View
  onChange: (next: View) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Dashboard view"
      className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-border bg-background p-1 shadow-xs"
    >
      {VIEWS.map(v => {
        const on = value === v.id
        return (
          <button
            key={v.id}
            role="radio"
            aria-checked={on}
            type="button"
            onClick={() => onChange(v.id)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              on
                ? 'bg-accent-blue/10 text-accent-blue'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
