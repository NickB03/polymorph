'use client'

import { useMemo, useRef } from 'react'

import { cn } from '@/lib/utils'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { MarkdownMessage } from './message'
import ProcessHeader from './process-header'

interface ReasoningContent {
  reasoning: string
  isDone: boolean
}

export interface ReasoningSectionProps {
  content: ReasoningContent
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  showIcon?: boolean
  variant?: 'default' | 'minimal' | 'process' | 'process-sub'
  isSingle?: boolean // Whether this is a single item or part of a group
  isFirst?: boolean
  isLast?: boolean
}

export function ReasoningSection({
  content,
  isOpen,
  onOpenChange,
  showIcon = false,
  variant = 'default',
  isSingle = true,
  isFirst = false,
  isLast = false
}: ReasoningSectionProps) {
  // Show a short preview when collapsed; switch to a generic label when expanded
  const HEADER_PREVIEW_CHARS = 120
  const SANITIZE_MARKDOWN_PREVIEW = true

  const toPreview = (text: string) => {
    const firstLine = (text || '').split(/\r?\n/)[0] || ''
    if (!SANITIZE_MARKDOWN_PREVIEW) return firstLine
    return firstLine
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // links [text](url)
      .replace(/`([^`]+)`/g, '$1') // inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1') // bold **text**
      .replace(/__([^_]+)__/g, '$1') // bold __text__
      .replace(/^#{1,6}\s*/, '') // heading markers at start
  }

  // why: lock the first preview we see during streaming to avoid label churn;
  // switch to the final string once streaming completes. The ref is a pure
  // memoisation layer — the computed preview is identical whether served from
  // cache or recomputed — and using state here would flag set-state-in-effect.
  const streamingPreviewRef = useRef<string | null>(null)
  /* eslint-disable react-hooks/refs */
  const preview = useMemo(() => {
    const text = content?.reasoning || ''
    if (!text) return streamingPreviewRef.current
    const prepared = toPreview(text).slice(0, HEADER_PREVIEW_CHARS)
    if (content.isDone) {
      streamingPreviewRef.current = prepared
      return prepared
    }
    if (!streamingPreviewRef.current) streamingPreviewRef.current = prepared
    return streamingPreviewRef.current
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toPreview is stable, inline
  }, [content?.reasoning, content?.isDone])
  /* eslint-enable react-hooks/refs */

  const headerLabel = isOpen
    ? 'Thoughts'
    : preview && preview.length > 0
      ? preview
      : !content.isDone
        ? 'Thinking...'
        : 'Thoughts'

  const reasoningHeader = (
    <ProcessHeader
      label={
        !isSingle ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-4 h-4 shrink-0 flex items-center justify-center relative">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            </div>
            <span className="truncate block min-w-0 max-w-full">
              {headerLabel}
            </span>
          </div>
        ) : (
          headerLabel
        )
      }
      isLoading={!content.isDone}
      ariaExpanded={isOpen}
    />
  )

  if (!content) return <DefaultSkeleton />

  // Return null if done and reasoning text is empty
  if (content.isDone && !content.reasoning?.trim()) return null

  return (
    <div className="relative">
      {/* Rails for header - show based on position */}
      {!isSingle && (
        <>
          {!isFirst && (
            <div className="absolute left-[19.5px] w-px bg-border h-2 top-0" />
          )}
          {!isLast && (
            <div className="absolute left-[19.5px] w-px bg-border h-2 bottom-0" />
          )}
        </>
      )}
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={reasoningHeader}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showBorder={isSingle}
        showIcon={showIcon}
        variant={variant}
        showSeparator={false}
        headerClickBehavior="split"
      >
        <div className="flex">
          {/* Rail space - always reserved when grouped */}
          {!isSingle && (
            <>
              <div className="w-[16px] shrink-0 flex justify-center">
                <div
                  className={cn(
                    'w-px bg-border/50 transition-opacity duration-200',
                    isOpen ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{
                    marginTop: isFirst ? '0' : '-1rem',
                    marginBottom: isLast ? '0' : '-1rem'
                  }}
                />
              </div>
              <div className="w-2 shrink-0" />
            </>
          )}
          <div className="[&_p]:text-xs [&_p]:text-muted-foreground/80 flex-1">
            <MarkdownMessage message={content.reasoning} />
          </div>
        </div>
      </CollapsibleMessage>
    </div>
  )
}
