import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

interface FeaturePagerProps {
  activeIndex: number
  total: number
  onPrev: () => void
  onNext: () => void
}

export function FeaturePager({
  activeIndex,
  total,
  onPrev,
  onNext
}: FeaturePagerProps) {
  const atStart = activeIndex === 0
  const atEnd = activeIndex === total - 1

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={atStart}
        onClick={onPrev}
        className="gap-1"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Previous
      </Button>

      <div className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            data-testid="feature-pager-dot"
            data-active={i === activeIndex}
            className={cn(
              'size-1.5 rounded-full transition-colors',
              i === activeIndex ? 'bg-foreground' : 'bg-muted-foreground/40'
            )}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={atEnd}
        onClick={onNext}
        className="gap-1"
      >
        Next
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
