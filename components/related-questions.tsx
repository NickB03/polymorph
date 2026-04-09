'use client'

import { ArrowRight, Repeat2 } from 'lucide-react'

import type { RelatedQuestionsData } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import { useTickerRotation } from '@/hooks/use-ticker-rotation'

import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'

const DISPLAY_MS = 3000
const MAX_SHOWN_QUESTIONS = 3
const ROTATIONS = 2

interface RelatedQuestionsProps {
  data: RelatedQuestionsData
  onQuerySelect: (query: string) => void
  isLatestMessage?: boolean
}

function renderSkeletonRow(index: number) {
  return (
    <div
      className="flex items-start w-full"
      key={`related-question-skeleton-${index}`}
    >
      <ArrowRight className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-accent-foreground/50" />
      <Skeleton
        className="h-6 w-full"
        data-testid="related-question-skeleton"
      />
    </div>
  )
}

export function RelatedQuestions({
  data,
  onQuerySelect,
  isLatestMessage = false
}: RelatedQuestionsProps) {
  const questions = data.questions ?? []
  const isReady = data.status === 'success' && questions.length > 0
  const isTickerActive = isReady && isLatestMessage

  const { activeIndex, phase, isComplete, pause, resume } = useTickerRotation({
    items: questions,
    displayMs: DISPLAY_MS,
    rotations: ROTATIONS,
    isActive: isTickerActive
  })

  const currentQuestion =
    activeIndex >= 0 && activeIndex < questions.length
      ? questions[activeIndex]
      : null

  return (
    <section className="rounded-2xl border border-border/60 bg-card/80 px-3 py-2 shadow-sm">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Repeat2 size={16} className="text-muted-foreground" />
        <span data-testid="related-questions-label">Related</span>
      </div>

      {data.status === 'loading' && (
        <div
          className="mt-2 flex flex-col gap-2"
          data-testid="related-questions-loading"
        >
          {Array.from({ length: MAX_SHOWN_QUESTIONS }).map((_, index) =>
            renderSkeletonRow(index)
          )}
        </div>
      )}

      {data.status === 'streaming' && (
        <div
          className="mt-2 flex flex-col gap-2"
          data-testid="related-questions-streaming"
        >
          {questions.map((item, index) => (
            <div
              className="flex items-start w-full"
              key={item.question || index}
            >
              <ArrowRight className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-accent-foreground/50" />
              <Button
                type="button"
                variant="link"
                className="flex-1 justify-start px-0 py-0 h-fit font-semibold text-accent-foreground/50 whitespace-normal text-left"
                onClick={() => onQuerySelect(item.question)}
              >
                {item.question}
              </Button>
            </div>
          ))}
          {Array.from({
            length: Math.max(0, MAX_SHOWN_QUESTIONS - questions.length)
          }).map((_, index) => renderSkeletonRow(index))}
        </div>
      )}

      {data.status === 'error' && (
        <div
          className="mt-2 text-sm text-muted-foreground"
          data-testid="related-questions-error"
        >
          Failed to generate related questions
        </div>
      )}

      {isTickerActive && !isComplete && currentQuestion && (
        <div
          className="mt-2 flex items-center gap-2"
          data-testid="related-questions-ticker"
          aria-live="polite"
          aria-atomic="true"
          onMouseEnter={pause}
          onMouseLeave={resume}
        >
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
          >
            <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
            <span className="truncate">{currentQuestion.question}</span>
          </Button>
        </div>
      )}
    </section>
  )
}

export default RelatedQuestions
