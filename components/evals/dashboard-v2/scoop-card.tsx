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
  // Suite tab: 140px tall, ~140px circle clipped to the icon area
  lg: {
    card: 'min-h-[140px] gap-5 p-6',
    scoop: 'h-[180px] w-[140px] -left-[60px] -top-[20px]',
    iconSlot: 'size-12'
  },
  // KPI tile: 92px tall, ~88px circle clipped to the icon area
  sm: {
    card: 'min-h-[92px] gap-3 p-4',
    scoop: 'h-[120px] w-[88px] -left-[36px] -top-[14px]',
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
