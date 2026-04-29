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
        <span
          className={[
            'cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-[3px] transition-colors hover:decoration-foreground',
            className
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {def}
      </TooltipContent>
    </Tooltip>
  )
}
