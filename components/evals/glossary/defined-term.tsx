'use client'

import type { ReactNode } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

export function DefinedTerm({
  def,
  className,
  children
}: {
  def: string
  className?: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={[
            'inline cursor-help appearance-none border-0 bg-transparent p-0 font-[inherit] text-inherit underline decoration-dotted decoration-muted-foreground/50 underline-offset-[3px] transition-colors hover:decoration-foreground',
            className
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {def}
      </TooltipContent>
    </Tooltip>
  )
}
