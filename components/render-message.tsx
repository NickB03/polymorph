import type { ReactNode } from 'react'

import { UseChatHelpers } from '@ai-sdk/react'

import type { SearchResultItem } from '@/lib/types'
import type {
  ToolPart,
  UIDataTypes,
  UIMessage,
  UIMessageMetadata,
  UITools
} from '@/lib/types/ai'
import type { DynamicToolPart } from '@/lib/types/dynamic-tools'
import { isChatLoading } from '@/lib/utils'

import { OptionList } from './tool-ui/option-list/option-list'
import type { OptionListSelection } from './tool-ui/option-list/schema'
import { safeParseSerializableOptionList } from './tool-ui/option-list/schema'
import type { TodoWriteOutput } from './tool-ui/plan/from-todo-write'
import { tryRenderToolUI, tryRenderToolUIByName } from './tool-ui/registry'
import { AnswerSection } from './answer-section'
import { DynamicToolDisplay } from './dynamic-tool-display'
import { ResearchPlan } from './research-plan'
import ResearchProcessSection from './research-process-section'
import { ResearchStatusLine } from './research-status-line'
import { UserFileSection } from './user-file-section'
import { UserTextSection } from './user-text-section'

/** Single-pass scan of message parts for todoWrite state and research tool activity. */
function scanTodoWriteParts(parts: UIMessage['parts']) {
  let firstTodoWriteIndex: number | undefined
  let latestOutput: TodoWriteOutput | undefined
  let isStreaming = false
  let hasError = false
  let completedToolCalls = 0
  let hasActiveToolCall = false

  for (let i = 0; i < (parts?.length ?? 0); i++) {
    const part = parts![i]

    // Count research tool activity after plan creation
    if (firstTodoWriteIndex !== undefined && part.type !== 'tool-todoWrite') {
      const type = part.type
      if (type === 'tool-search' || type === 'tool-fetch') {
        const state = (part as { state?: string }).state
        if (state === 'output-available') completedToolCalls++
        else if (state === 'input-streaming' || state === 'input-available')
          hasActiveToolCall = true
      }
      continue
    }

    if (part.type !== 'tool-todoWrite') continue

    if (firstTodoWriteIndex === undefined) firstTodoWriteIndex = i

    const state = (part as ToolPart<'todoWrite'>).state
    if (state === 'output-available') {
      latestOutput = (part as ToolPart<'todoWrite'>).output
    } else if (state === 'input-streaming' || state === 'input-available') {
      isStreaming = true
    } else if (state === 'output-error') {
      hasError = true
    }
  }

  return {
    firstTodoWriteIndex,
    latestOutput,
    isStreaming,
    hasError,
    completedToolCalls,
    hasActiveToolCall
  }
}

/** Segments produced by extractToolUIFromText */
type TextSegment = { type: 'text'; content: string }
type ToolUISegment = { type: 'tool-ui'; component: ReactNode; key: string }
type Segment = TextSegment | ToolUISegment

/**
 * Scan text for ```json fenced code blocks that match a registered tool UI schema.
 * Returns the original text unchanged if no matches are found.
 */
function extractToolUIFromText(text: string): Segment[] {
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n\s*```/g
  const segments: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let toolUIFound = false

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      const rendered = tryRenderToolUI(parsed)
      if (rendered) {
        toolUIFound = true
        if (match.index > lastIndex) {
          segments.push({
            type: 'text',
            content: text.slice(lastIndex, match.index)
          })
        }
        segments.push({
          type: 'tool-ui',
          component: rendered,
          key: `extracted-${match.index}`
        })
        lastIndex = match.index + match[0].length
      }
    } catch {
      // Not valid JSON or no schema match — leave as-is
    }
  }

  if (!toolUIFound) return [{ type: 'text', content: text }]

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }
  return segments
}

interface RenderMessageProps {
  message: UIMessage
  messageId: string
  getIsOpen: (id: string, partType?: string, hasNextPart?: boolean) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
  chatId?: string
  isGuest?: boolean
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (messageId: string) => Promise<void | string | null | undefined>
  isLatestMessage?: boolean
  citationMaps?: Record<string, Record<number, SearchResultItem>>
  isResearchMode?: boolean
}

export function RenderMessage({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  onQuerySelect,
  chatId,
  isGuest = false,
  status,
  addToolResult,
  onUpdateMessage,
  reload,
  isLatestMessage = false,
  citationMaps = {},
  isResearchMode = false
}: RenderMessageProps) {
  // Use provided citation maps (from all messages)
  if (message.role === 'user') {
    return (
      <>
        {message.parts?.map((part, index) => {
          switch (part.type) {
            case 'text':
              return (
                <UserTextSection
                  key={`${messageId}-user-text-${index}`}
                  content={part.text}
                  messageId={messageId}
                  onUpdateMessage={onUpdateMessage}
                />
              )
            case 'file':
              return (
                <UserFileSection
                  key={`${messageId}-user-file-${index}`}
                  file={{
                    name: part.filename || 'Unknown file',
                    url: part.url,
                    contentType: part.mediaType
                  }}
                />
              )
            default:
              return null
          }
        })}
      </>
    )
  }

  // Pre-scan: identify todoWrite parts for the Research Plan component.
  // Single pass collects the first index, latest resolved output, and state flags.
  const todoScan = scanTodoWriteParts(message.parts)
  const { firstTodoWriteIndex } = todoScan

  // New rendering: interleave text parts with grouped non-text segments
  const elements: React.ReactNode[] = []
  // Buffer collects non-text parts for ResearchProcessSection.
  let buffer: NonNullable<UIMessage['parts']>[number][] = []
  const flushBuffer = (keySuffix: string) => {
    if (buffer.length === 0) return
    elements.push(
      <ResearchProcessSection
        key={`${messageId}-proc-${keySuffix}`}
        message={message}
        messageId={messageId}
        parts={buffer as Parameters<typeof ResearchProcessSection>[0]['parts']}
        getIsOpen={getIsOpen}
        onOpenChange={onOpenChange}
        onQuerySelect={onQuerySelect}
        status={status}
        addToolResult={addToolResult}
      />
    )
    buffer = []
  }

  // Deferred-first-tool pattern: buffer display tools that arrive before
  // the first text part, then flush them immediately after the first text.
  let hasSeenText = false
  const deferredDisplayParts: { part: any; index: number }[] = []

  // Render a display tool part into a React element
  const renderDisplayToolElement = (
    displayPart: any,
    partIndex: number
  ): React.ReactNode => {
    const toolName = displayPart.type.substring(5) // Remove 'tool-' prefix
    const toolPart = displayPart as {
      state?: string
      input?: unknown
      output?: unknown
      toolCallId?: string
    }

    // In research mode, suppress citations and link previews (rendered in activity sidebar)
    if (
      isResearchMode &&
      (toolName === 'displayCitations' || toolName === 'displayLinkPreview')
    ) {
      return null
    }

    if (toolName === 'displayOptionList') {
      if (toolPart.state === 'output-available') {
        const parsed = safeParseSerializableOptionList(toolPart.input)
        if (parsed) {
          // Research depth → compact status line instead of receipt card
          if (parsed.id === 'research-depth') {
            const selectedOption = parsed.options.find(
              opt => opt.id === toolPart.output
            )
            return (
              <ResearchStatusLine
                key={`${messageId}-display-tool-${partIndex}`}
                selectedLabel={selectedOption?.label ?? 'Research'}
                isStreaming={isLatestMessage && isChatLoading(status)}
              />
            )
          }
          // Non-depth option lists keep their receipt card
          return (
            <div
              key={`${messageId}-display-tool-${partIndex}`}
              className="my-2"
            >
              <OptionList
                {...parsed}
                choice={toolPart.output as OptionListSelection}
              />
            </div>
          )
        }
      } else if (toolPart.state === 'input-available') {
        const parsed = safeParseSerializableOptionList(toolPart.input)
        if (parsed) {
          return (
            <div
              key={`${messageId}-display-tool-${partIndex}`}
              className="my-2"
            >
              <OptionList
                {...parsed}
                onAction={(actionId, selection) => {
                  if (toolPart.toolCallId) {
                    addToolResult?.({
                      toolCallId: toolPart.toolCallId,
                      result: selection
                    })
                  }
                }}
              />
            </div>
          )
        }
      } else {
        return (
          <div
            key={`${messageId}-display-tool-${partIndex}`}
            className="my-2 h-24 animate-pulse rounded-lg bg-muted"
          />
        )
      }
    } else {
      if (toolPart.state === 'output-available' && toolPart.output) {
        const rendered = tryRenderToolUIByName(toolName, toolPart.output)
        return (
          <div key={`${messageId}-display-tool-${partIndex}`} className="my-2">
            {rendered ?? (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {toolName} output could not be rendered
              </div>
            )}
          </div>
        )
      } else if (toolPart.state === 'output-error') {
        return (
          <div
            key={`${messageId}-display-tool-${partIndex}`}
            className="my-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
          >
            {toolName} output could not be rendered
          </div>
        )
      } else if (
        toolPart.state === 'input-streaming' ||
        toolPart.state === 'input-available'
      ) {
        return (
          <div
            key={`${messageId}-display-tool-${partIndex}`}
            className="my-2 h-24 animate-pulse rounded-lg bg-muted"
          />
        )
      }
    }
    return null
  }

  message.parts?.forEach((part, index) => {
    if (part.type === 'text') {
      // Suppress intro text preceding a completed research-depth option list.
      // The status line replaces both the question text and the receipt card.
      const nextPart = message.parts?.[index + 1]
      if (nextPart?.type === 'tool-displayOptionList') {
        const nextToolPart = nextPart as { state?: string; input?: unknown }
        if (nextToolPart.state === 'output-available') {
          const nextParsed = safeParseSerializableOptionList(nextToolPart.input)
          if (nextParsed?.id === 'research-depth') {
            return
          }
        }
      }

      // Flush accumulated non-text parts before rendering text
      flushBuffer(`seg-${index}`)

      const remainingParts = message.parts?.slice(index + 1) || []
      const hasMoreTextParts = remainingParts.some(p => p.type === 'text')
      const isLastTextPart = !hasMoreTextParts
      const isStreamingComplete =
        status !== 'streaming' && status !== 'submitted'
      const shouldShowActions =
        isLastTextPart && (isLatestMessage ? isStreamingComplete : true)

      const segments = extractToolUIFromText(part.text)
      for (let si = 0; si < segments.length; si++) {
        const segment = segments[si]
        if (segment.type === 'tool-ui') {
          elements.push(
            <div
              key={`${messageId}-extracted-tool-${index}-${segment.key}`}
              className="my-2"
            >
              {segment.component}
            </div>
          )
        } else if (segment.content.trim()) {
          // Only show actions on the very last text segment of the last text part
          const isLastSegment = si === segments.length - 1
          elements.push(
            <AnswerSection
              key={`${messageId}-text-${index}-${si}`}
              content={segment.content}
              isOpen={getIsOpen(
                messageId,
                part.type,
                index < (message.parts?.length ?? 0) - 1
              )}
              onOpenChange={open => onOpenChange(messageId, open)}
              chatId={chatId}
              isGuest={isGuest}
              showActions={shouldShowActions && isLastSegment}
              messageId={messageId}
              metadata={message.metadata as UIMessageMetadata | undefined}
              reload={reload}
              status={status}
              citationMaps={citationMaps}
            />
          )
        }
      }

      // Mark that we've seen text content
      hasSeenText = true

      // Flush any display tools that were deferred (arrived before first text)
      for (const deferred of deferredDisplayParts) {
        elements.push(renderDisplayToolElement(deferred.part, deferred.index))
      }
      deferredDisplayParts.length = 0
    } else if (part.type?.startsWith?.('tool-display')) {
      if (!hasSeenText) {
        // Buffer display tools arriving before any text
        deferredDisplayParts.push({ part, index })
      } else {
        // After first text, render display tools inline at natural position
        flushBuffer(`seg-${index}`)
        elements.push(renderDisplayToolElement(part, index))
      }
    } else if (part.type === 'tool-todoWrite') {
      // todoWrite parts render as a single Research Plan, not in the buffer.
      // Only the first position renders; subsequent parts are skipped.
      if (index === firstTodoWriteIndex) {
        flushBuffer(`seg-${index}`)
        elements.push(
          <ResearchPlan
            key={`${messageId}-research-plan`}
            output={todoScan.latestOutput}
            isStreaming={!todoScan.latestOutput && todoScan.isStreaming}
            hasError={todoScan.hasError && !todoScan.latestOutput}
            completedToolCalls={todoScan.completedToolCalls}
            hasActiveToolCall={todoScan.hasActiveToolCall}
            isComplete={isLatestMessage ? !isChatLoading(status) : true}
          />
        )
      }
    } else if (
      part.type === 'reasoning' ||
      part.type?.startsWith?.('tool-') ||
      part.type?.startsWith?.('data-')
    ) {
      buffer.push(part)
    } else if (part.type === 'dynamic-tool') {
      flushBuffer(`seg-${index}`)
      elements.push(
        <DynamicToolDisplay
          key={`${messageId}-dynamic-tool-${index}`}
          part={part as DynamicToolPart}
        />
      )
    }
  })

  // Edge case: tool-only response (no text at all) — render deferred tools at end
  for (const deferred of deferredDisplayParts) {
    elements.push(renderDisplayToolElement(deferred.part, deferred.index))
  }

  // Flush tail (no subsequent text)
  flushBuffer('tail')

  return <>{elements}</>
}
