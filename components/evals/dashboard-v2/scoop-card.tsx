import { type HTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type ScoopTint = 'ready' | 'watch' | 'blocked' | 'neutral'
export type ScoopSize = 'lg' | 'sm'

const TINT_CLASS: Record<ScoopTint, string> = {
  ready: 'bg-success/20',
  watch: 'bg-warning/25',
  blocked: 'bg-destructive/25',
  neutral: 'bg-muted/60'
}

const SIZE_CLASS: Record<
  ScoopSize,
  { card: string; scoop: string; iconSlot: string }
> = {
  // Suite tab: 140px tall, 180×240 ellipse anchored top-left as a corner spotlight
  lg: {
    card: 'min-h-[140px] py-5 pl-[88px] pr-6',
    scoop: 'w-[180px] h-[240px] -left-[70px] -top-[60px]',
    iconSlot: 'absolute left-[20px] top-1/2 -translate-y-1/2 size-10'
  },
  // KPI tile: 88px tall, 110×140 ellipse with the same corner-spotlight gesture
  sm: {
    card: 'min-h-[88px] py-3 pl-[52px] pr-4',
    scoop: 'w-[110px] h-[140px] -left-[44px] -top-[36px]',
    iconSlot: 'absolute left-[12px] top-1/2 -translate-y-1/2 size-6'
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
        'relative flex items-center overflow-hidden rounded-xl border border-border bg-card text-left transition-colors',
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
          'z-[1] flex items-center justify-center text-foreground',
          sz.iconSlot
        )}
      >
        {icon}
      </div>
      <div className="relative z-[1] w-full min-w-0">{children}</div>
    </div>
  )
}
