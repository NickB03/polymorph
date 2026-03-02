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

import { OptionList } from './tool-ui/option-list/option-list'
import type { OptionListSelection } from './tool-ui/option-list/schema'
import { safeParseSerializableOptionList } from './tool-ui/option-list/schema'
import type { TodoWriteOutput } from './tool-ui/plan/from-todo-write'
import { tryRenderToolUIByName } from './tool-ui/registry'
import { AnswerSection } from './answer-section'
import { DynamicToolDisplay } from './dynamic-tool-display'
import { ResearchPlan } from './research-plan'
import ResearchProcessSection from './research-process-section'
import { UserFileSection } from './user-file-section'
import { UserTextSection } from './user-text-section'

/** Single-pass scan of message parts for todoWrite state. */
function scanTodoWriteParts(parts: UIMessage['parts']) {
  let firstTodoWriteIndex: number | undefined
  let latestOutput: TodoWriteOutput | undefined
  let isStreaming = false
  let hasError = false

  for (let i = 0; i < (parts?.length ?? 0); i++) {
    const part = parts![i]
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

  return { firstTodoWriteIndex, latestOutput, isStreaming, hasError }
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
  citationMaps = {}
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
  // Uses any[] because UIMessage['parts'] is wider than ResearchProcessSection's MessagePart union.
  let buffer: any[] = []
  const flushBuffer = (keySuffix: string) => {
    if (buffer.length === 0) return
    elements.push(
      <ResearchProcessSection
        key={`${messageId}-proc-${keySuffix}`}
        message={message}
        messageId={messageId}
        parts={buffer}
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

    if (toolName === 'displayOptionList') {
      if (toolPart.state === 'output-available') {
        const parsed = safeParseSerializableOptionList(toolPart.input)
        if (parsed) {
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
      // Suppress near-empty text parts adjacent to display tools.
      // Catches trivial intros/outros (whitespace-only or bare headings)
      // that the LLM sometimes emits around display tool calls.
      const isNearEmpty =
        !part.text.trim() || /^#{1,3}\s+.{0,80}$/.test(part.text.trim())
      if (isNearEmpty) {
        const prevPart = message.parts?.[index - 1]
        const followsDisplayTool = prevPart?.type?.startsWith?.('tool-display')
        if (followsDisplayTool) return
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

      elements.push(
        <AnswerSection
          key={`${messageId}-text-${index}`}
          content={part.text}
          isOpen={getIsOpen(
            messageId,
            part.type,
            index < (message.parts?.length ?? 0) - 1
          )}
          onOpenChange={open => onOpenChange(messageId, open)}
          chatId={chatId}
          isGuest={isGuest}
          showActions={shouldShowActions}
          messageId={messageId}
          metadata={message.metadata as UIMessageMetadata | undefined}
          reload={reload}
          status={status}
          citationMaps={citationMaps}
        />
      )

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
