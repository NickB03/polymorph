import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'

import { deltaPts } from '@/components/evals/dashboard/shared'

type Direction = 'up' | 'down' | 'flat'

const ICON: Record<Direction, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus
}

const COLOR: Record<Direction, string> = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground'
}

export function Delta({
  value,
  className
}: {
  value: number | null
  className?: string
}) {
  if (value == null) {
    return <span className={cn('text-muted-foreground', className)}>—</span>
  }

  const rounded = Math.round(value * 100)
  const direction: Direction =
    rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat'
  const Icon = ICON[direction]
  const text = deltaPts(value)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-xs tabular-nums',
        COLOR[direction],
        className
      )}
      data-direction={direction}
    >
      <Icon
        aria-hidden="true"
        className="size-3"
        data-testid={`delta-icon-${direction}`}
      />
      <span>{text}</span>
    </span>
  )
}
