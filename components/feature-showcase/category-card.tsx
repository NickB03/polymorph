import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface CategoryCardProps {
  title: string
  description: string
  Icon: LucideIcon
  active: boolean
  onClick: () => void
}

export function CategoryCard({
  title,
  description,
  Icon,
  active,
  onClick
}: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
        active ? 'bg-muted ring-1 ring-border' : 'hover:bg-muted/60'
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors',
          active
            ? 'border-foreground/40 text-foreground'
            : 'border-border text-muted-foreground'
        )}
      >
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            'text-sm font-medium',
            active ? 'text-foreground' : 'text-foreground/80'
          )}
        >
          {title}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  )
}
