'use client'

import { cn } from '@/lib/utils'

export function AnimatedLogo({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-1.5 h-8', className)}
      role="img"
      aria-label="Loading"
      {...props}
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="dot-wave size-2 rounded-full bg-foreground/60"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  )
}
