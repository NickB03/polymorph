import { type HTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type ScoopTint = 'ready' | 'watch' | 'blocked' | 'neutral'
export type ScoopSize = 'lg' | 'sm'

const TINT_CLASS: Record<ScoopTint, string> = {
  ready: 'bg-success-bg',
  watch: 'bg-warning-bg',
  blocked: 'bg-destructive/15',
  neutral: 'bg-muted'
}

const SIZE_CLASS: Record<
  ScoopSize,
  { card: string; scoop: string; iconSlot: string }
> = {
  // Suite tab: 140px tall, 240×180 ellipse anchored at (-70, -60)
  lg: {
    card: 'min-h-[140px] p-5',
    scoop: 'h-60 w-45 -left-[70px] -top-[60px]',
    iconSlot: 'size-12'
  },
  // KPI tile: 90px tall, 120×80 ellipse anchored at (-25, -30)
  sm: {
    card: 'min-h-[90px] p-3.5',
    scoop: 'h-30 w-20 -left-[25px] -top-[30px]',
    iconSlot: 'size-7'
  }
}

export function ScoopCard({
  tint,
  size = 'lg',
  icon,
  active = false,
  className,
  children,
  ...rest
}: {
  tint: ScoopTint
  size?: ScoopSize
  icon: ReactNode
  active?: boolean
  className?: string
  children: ReactNode
} & Omit<HTMLAttributes<HTMLDivElement>, 'children'>) {
  const sz = SIZE_CLASS[size]
  return (
    <div
      data-testid="scoop-card-root"
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-background text-left transition-colors',
        sz.card,
        active && 'ring-2 ring-accent-blue ring-offset-0',
        className
      )}
      {...rest}
    >
      <span
        aria-hidden
        data-testid="scoop"
        className={cn(
          'pointer-events-none absolute rounded-full',
          TINT_CLASS[tint],
          sz.scoop
        )}
      />
      <div
        className={cn(
          'relative z-[1] flex shrink-0 items-center justify-center',
          sz.iconSlot
        )}
      >
        {icon}
      </div>
      <div className="relative z-[1] min-w-0 flex-1">{children}</div>
    </div>
  )
}
