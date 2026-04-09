'use client'

import { useMemo } from 'react'

import { ArrowRight, Repeat2 } from 'lucide-react'

import type { RelatedQuestionsData } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import { useTickerRotation } from '@/hooks/use-ticker-rotation'

import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'

const DISPLAY_MS = 3000
const ROTATIONS = 2

interface RelatedQuestionsProps {
  data: RelatedQuestionsData
  onQuerySelect: (query: string) => void
  isLatestMessage?: boolean
}

export function RelatedQuestions({
  data,
  onQuerySelect,
  isLatestMessage = false
}: RelatedQuestionsProps) {
  const questions = useMemo(() => data.questions ?? [], [data.questions])
  const isReady = data.status === 'success' && questions.length > 0
  const isTickerActive = isReady && isLatestMessage

  const { activeIndex, phase, isComplete, pause, resume, restart } =
    useTickerRotation({
      items: questions,
      displayMs: DISPLAY_MS,
      rotations: ROTATIONS,
      isActive: isTickerActive
    })

  const currentQuestion =
    activeIndex >= 0 && activeIndex < questions.length
      ? questions[activeIndex]
      : null

  const showTicker = isTickerActive && !isComplete && currentQuestion

  return (
    <section
      className="flex items-center gap-1.5 overflow-hidden rounded-2xl border border-border/60 bg-card/80 px-3 py-2 shadow-sm"
      onMouseEnter={isTickerActive ? (isComplete ? restart : pause) : undefined}
      onMouseLeave={isTickerActive && !isComplete ? resume : undefined}
    >
      <Repeat2 size={16} className="shrink-0 text-muted-foreground" />
      <span
        className="shrink-0 text-sm font-semibold text-muted-foreground"
        data-testid="related-questions-label"
      >
        Related
      </span>

      {data.status === 'loading' && (
        <Skeleton
          className="ml-0.5 h-4 w-48"
          data-testid="related-question-skeleton"
        />
      )}

      {data.status === 'streaming' && questions.length === 0 && (
        <Skeleton
          className="ml-0.5 h-4 w-48"
          data-testid="related-question-skeleton"
        />
      )}

      {data.status === 'streaming' && questions.length > 0 && (
        <>
          <span className="h-3.5 w-px shrink-0 bg-border" />
          <Button
            type="button"
            variant="link"
            className="min-w-0 flex-1 justify-start px-0 py-0 h-auto font-semibold text-accent-foreground/50 whitespace-nowrap text-left no-underline truncate"
            onClick={() => onQuerySelect(questions[0].question)}
          >
            <ArrowRight className="mr-1 h-3.5 w-3.5 shrink-0 opacity-50" />
            <span className="truncate">{questions[0].question}</span>
          </Button>
        </>
      )}

      {data.status === 'error' && (
        <span
          className="ml-0.5 text-sm text-muted-foreground"
          data-testid="related-questions-error"
        >
          Failed to load
        </span>
      )}

      {showTicker && (
        <>
          <span className="h-3.5 w-px shrink-0 bg-border" />
          <Button
            type="button"
            variant="link"
            className={cn(
              'flex min-w-0 flex-1 items-center justify-start gap-1.5 px-0 py-0 h-auto font-semibold text-accent-foreground/60 whitespace-nowrap text-left no-underline hover:text-accent-foreground',
              phase === 'entering' && 'animate-ticker-in',
              phase === 'exiting' && 'animate-ticker-out',
              phase === 'visible' && 'opacity-100'
            )}
            onClick={() => onQuerySelect(currentQuestion.question)}
            data-testid="related-questions-ticker"
            aria-live="polite"
            aria-atomic="true"
          >
            <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
            <span className="truncate">{currentQuestion.question}</span>
          </Button>
        </>
      )}
    </section>
  )
}
