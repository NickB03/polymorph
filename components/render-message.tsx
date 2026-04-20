import { Fragment, type ReactNode } from 'react'

import { UseChatHelpers } from '@ai-sdk/react'

import type { SearchResultItem } from '@/lib/types'
import type {
  CanvasArtifactData,
  CanvasArtifactStatusData,
  ToolPart,
  UIDataTypes,
  UIMessage,
  UIMessageMetadata,
  UITools
} from '@/lib/types/ai'
import type { DynamicToolPart } from '@/lib/types/dynamic-tools'
import { isChatLoading } from '@/lib/utils'

import {
  CanvasArtifactCard,
  tryParseCanvasArtifactCardData
} from './tool-ui/canvas-artifact-card'
import { GenerateImage } from './tool-ui/generate-image'
import { safeParseSerializableGenerateImage } from './tool-ui/generate-image/schema'
import { OptionList } from './tool-ui/option-list/option-list'
import type { OptionListSelection } from './tool-ui/option-list/schema'
import { safeParseSerializableOptionList } from './tool-ui/option-list/schema'
import type { TodoWriteOutput } from './tool-ui/plan/from-todo-write'
import { QuestionWizard } from './tool-ui/question-wizard/question-wizard'
import type { WizardResult } from './tool-ui/question-wizard/schema'
import { safeParseSerializableQuestionWizard } from './tool-ui/question-wizard/schema'
import { tryRenderToolUI, tryRenderToolUIByName } from './tool-ui/registry'
import { AnswerSection } from './answer-section'
import { DynamicToolDisplay } from './dynamic-tool-display'
import { MessageActions } from './message-actions'
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

const PSEUDO_DISPLAY_TOOL_PLACEHOLDER_PATTERNS = [
  {
    matchedPattern: 'fenced-comment-placeholder',
    pattern:
      /```(?:json|javascript|js|typescript|ts|tsx)?\s*\n\s*\/\*\s*(display[A-Za-z]+)\s+tool call\s*\*\/\s*\n```/g
  },
  {
    matchedPattern: 'fenced-function-placeholder',
    pattern:
      /```(?:json|javascript|js|typescript|ts|tsx)?\s*\n\s*(display[A-Za-z]+)\s*\([\s\S]*?\n```/g
  }
] as const

/**
 * Scan text for ```json fenced code blocks that match a registered tool UI schema.
 * Returns the original text unchanged if no matches are found.
 */
function extractToolUIFromText(text: string, messageId: string): Segment[] {
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n\s*```/g
  const segments: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let toolUIFound = false

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      const rendered = tryRenderToolUI(
        parsed,
        `${messageId}-extract-${match.index}`
      )
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

function collectCompletedDisplayToolResults(parts: UIMessage['parts']) {
  const completedDisplayTools = new Set<string>()

  for (const part of parts || []) {
    if (
      part.type?.startsWith?.('tool-display') &&
      'state' in part &&
      part.state === 'output-available'
    ) {
      completedDisplayTools.add(part.type.substring(5))
      continue
    }

    if (
      part.type === 'dynamic-tool' &&
      part.state === 'output-available' &&
      typeof part.toolName === 'string' &&
      part.toolName.startsWith('display')
    ) {
      completedDisplayTools.add(part.toolName)
    }
  }

  return completedDisplayTools
}

function stripPseudoDisplayToolPlaceholders({
  text,
  completedDisplayTools,
  messageId,
  metadata
}: {
  text: string
  completedDisplayTools: Set<string>
  messageId: string
  metadata?: UIMessageMetadata
}) {
  let sanitizedText = text
  let suppressedAny = false

  for (const {
    pattern,
    matchedPattern
  } of PSEUDO_DISPLAY_TOOL_PLACEHOLDER_PATTERNS) {
    sanitizedText = sanitizedText.replace(
      pattern,
      (match, toolName: string) => {
        if (completedDisplayTools.has(toolName)) {
          return match
        }

        suppressedAny = true
        console.debug(
          '[RenderMessage] Suppressed pseudo display tool placeholder',
          {
            messageId,
            modelId: metadata?.modelId,
            userMode: metadata?.userMode,
            toolName,
            matchedPattern
          }
        )
        return ''
      }
    )
  }

  if (!suppressedAny) return sanitizedText

  return sanitizedText.replace(/\n{3,}/g, '\n\n').trim()
}

/** Collect image URLs from completed generateImage tool parts for deduplication */
function collectGeneratedImageUrls(parts: UIMessage['parts']): Set<string> {
  const urls = new Set<string>()
  for (const part of parts || []) {
    if (part.type === 'tool-generateImage') {
      const toolPart = part as { state?: string; output?: unknown }
      if (toolPart.state === 'output-available' && toolPart.output) {
        const output = toolPart.output as { imageUrl?: string }
        if (output.imageUrl) urls.add(output.imageUrl)
      }
    }
  }
  return urls
}

/** Remove markdown image syntax that references already-rendered generated images */
function stripDuplicateImageMarkdown(
  text: string,
  generatedImageUrls: Set<string>
): string {
  if (generatedImageUrls.size === 0) return text
  return text.replace(
    /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)\n?/g,
    (match, url) => (generatedImageUrls.has(url) ? '' : match)
  )
}

function isHiddenInfrastructurePart(part: { type?: string } | undefined) {
  return (
    part?.type === 'data-canvasArtifactStatus' || part?.type === 'step-start'
  )
}

function mergeSequentialAssistantText(previous: string, next: string) {
  const previousTrimmed = previous.trim()
  const nextTrimmed = next.trim()

  if (!previousTrimmed) return next
  if (!nextTrimmed) return previous

  if (previousTrimmed === nextTrimmed) {
    return previous.length >= next.length ? previous : next
  }

  if (previousTrimmed.startsWith(nextTrimmed)) {
    return previous
  }

  if (nextTrimmed.startsWith(previousTrimmed)) {
    return next
  }

  return `${previous}\n\n${next}`
}

function normalizeRenderableParts(parts: UIMessage['parts']) {
  if (!parts) return []

  const normalizedParts: NonNullable<UIMessage['parts']> = []

  for (const part of parts) {
    if (isHiddenInfrastructurePart(part as { type?: string })) {
      continue
    }

    const lastPart = normalizedParts[normalizedParts.length - 1] as
      | { type?: string; text?: string; state?: string; providerMetadata?: any }
      | undefined

    if (part.type === 'text' && lastPart?.type === 'text') {
      normalizedParts[normalizedParts.length - 1] = {
        ...lastPart,
        ...part,
        text: mergeSequentialAssistantText(lastPart.text ?? '', part.text)
      } as NonNullable<UIMessage['parts']>[number]
      continue
    }

    normalizedParts.push(part)
  }

  return normalizedParts
}

function getLatestPersistedCanvasArtifactPartIndexes(
  parts: UIMessage['parts']
) {
  const latestIndexes = new Map<string, number>()

  for (const [index, part] of (parts || []).entries()) {
    if (part.type !== 'data-canvasArtifact') continue
    const data = (part as { data?: CanvasArtifactData }).data
    if (data?.artifactId) {
      latestIndexes.set(data.artifactId, index)
    }
  }

  return latestIndexes
}

function getLatestCanvasArtifactStatuses(parts: UIMessage['parts']) {
  const latestStatuses = new Map<
    string,
    CanvasArtifactStatusData & { sourceIndex: number }
  >()

  for (const [index, part] of (parts || []).entries()) {
    if (part.type !== 'data-canvasArtifactStatus') continue

    const data = (part as { data?: CanvasArtifactStatusData }).data
    if (data?.artifactId) {
      latestStatuses.set(data.artifactId, {
        ...data,
        sourceIndex: index
      })
    }
  }

  return latestStatuses
}

interface RenderMessageProps {
  message: UIMessage
  messageId: string
  getIsOpen: (id: string, partType?: string, hasNextPart?: boolean) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
  chatId?: string
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (messageId: string) => Promise<void | string | null | undefined>
  isLatestMessage?: boolean
  citationMaps?: Record<string, Record<number, SearchResultItem>>
  isResearchMode?: boolean
  /** Callback when a canvas artifact card is clicked */
  onCanvasArtifactClick?: (artifactId: string) => void
  /** Callback when a legacy artifact part is encountered */
  onLegacyArtifactClick?: (artifactId: string) => void
}

export function RenderMessage({
  message,
  messageId,
  getIsOpen,
  onOpenChange,
  onQuerySelect,
  chatId,
  status,
  addToolResult,
  onUpdateMessage,
  reload,
  isLatestMessage = false,
  citationMaps = {},
  isResearchMode = false,
  onCanvasArtifactClick,
  onLegacyArtifactClick
}: RenderMessageProps) {
  const metadata = message.metadata as UIMessageMetadata | undefined

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
  const renderParts = normalizeRenderableParts(message.parts)
  const latestPersistedCanvasArtifactPartIndexes =
    getLatestPersistedCanvasArtifactPartIndexes(renderParts)
  const latestCanvasArtifactStatuses = getLatestCanvasArtifactStatuses(
    message.parts
  )
  const generatedImageUrls = collectGeneratedImageUrls(message.parts)
  const completedDisplayToolResults = collectCompletedDisplayToolResults(
    message.parts
  )

  // Pre-compute: for each text part, whether there's any visible content after it.
  // Single reverse pass avoids O(n²) slice+some inside the render loop.
  const hasVisibleContentAfter = new Array<boolean>(renderParts.length)
  let seenVisible = false
  for (let i = renderParts.length - 1; i >= 0; i--) {
    hasVisibleContentAfter[i] = seenVisible
    const p = renderParts[i]
    if (
      p.type === 'text' ||
      p.type?.startsWith?.('tool-display') ||
      p.type === 'tool-createCanvasArtifact' ||
      p.type === 'tool-updateCanvasArtifact' ||
      p.type === 'data-canvasArtifact' ||
      p.type === 'dynamic-tool' ||
      (p.type as string) === 'data-artifact'
    ) {
      seenVisible = true
    }
  }

  // Interleave text parts with grouped non-text segments
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
        isLatestMessage={isLatestMessage}
      />
    )
    buffer = []
  }

  // Deferred-first-tool pattern: buffer display tools that arrive before
  // the first text part, then flush them immediately after the first text.
  let hasSeenText = false
  const deferredDisplayParts: { part: any; index: number }[] = []

  // Track whether actions were rendered inline (inside an AnswerSection)
  // or need to be appended at the very end of the message.
  let actionsShownInline = false
  let lastTextContent = ''
  let renderedTodoWrite = false

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
      return (
        <span
          key={`${messageId}-display-tool-${partIndex}`}
          className="sr-only"
        >
          Citations available in research activity panel
        </span>
      )
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
            <OptionList
              key={`${messageId}-display-tool-${partIndex}`}
              {...parsed}
              choice={toolPart.output as OptionListSelection}
            />
          )
        }
      } else if (toolPart.state === 'input-available') {
        const parsed = safeParseSerializableOptionList(toolPart.input)
        if (parsed) {
          return (
            <OptionList
              key={`${messageId}-display-tool-${partIndex}`}
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
          )
        }
      } else {
        return (
          <div
            key={`${messageId}-display-tool-${partIndex}`}
            className="h-24 animate-pulse rounded-lg bg-muted"
          />
        )
      }
    } else if (toolName === 'displayQuestionWizard') {
      if (toolPart.state === 'output-available') {
        const parsed = safeParseSerializableQuestionWizard(toolPart.input)
        if (parsed) {
          return (
            <QuestionWizard
              key={`${messageId}-display-tool-${partIndex}`}
              {...parsed}
              choice={toolPart.output as WizardResult}
            />
          )
        }
      } else if (toolPart.state === 'input-available') {
        const parsed = safeParseSerializableQuestionWizard(toolPart.input)
        if (parsed) {
          return (
            <QuestionWizard
              key={`${messageId}-display-tool-${partIndex}`}
              {...parsed}
              onAction={(_actionId, selection) => {
                if (toolPart.toolCallId) {
                  addToolResult?.({
                    toolCallId: toolPart.toolCallId,
                    result: selection
                  })
                }
              }}
            />
          )
        }
      } else {
        return (
          <div
            key={`${messageId}-display-tool-${partIndex}`}
            className="h-24 animate-pulse rounded-lg bg-muted"
          />
        )
      }
    } else {
      if (toolPart.state === 'output-available' && toolPart.output) {
        const rendered = tryRenderToolUIByName(
          toolName,
          toolPart.output,
          toolPart.toolCallId ?? `${messageId}-tool-${partIndex}`
        )
        return rendered ? (
          <Fragment key={`${messageId}-display-tool-${partIndex}`}>
            {rendered}
          </Fragment>
        ) : (
          <div
            key={`${messageId}-display-tool-${partIndex}`}
            className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
          >
            {toolName} output could not be rendered
          </div>
        )
      } else if (toolPart.state === 'output-error') {
        return (
          <div
            key={`${messageId}-display-tool-${partIndex}`}
            className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
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
            className="h-24 animate-pulse rounded-lg bg-muted"
          />
        )
      }
    }
    return null
  }

  renderParts.forEach((part, index) => {
    if (part.type === 'text') {
      // Suppress intro text preceding a completed research-depth option list.
      // The status line replaces both the question text and the receipt card.
      const nextPart = renderParts[index + 1]
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

      const isLastVisiblePart = !hasVisibleContentAfter[index]
      const isStreamingComplete =
        status !== 'streaming' && status !== 'submitted'
      const shouldShowActions =
        isLastVisiblePart && (isLatestMessage ? isStreamingComplete : true)

      const textContent = stripPseudoDisplayToolPlaceholders({
        text: stripDuplicateImageMarkdown(part.text, generatedImageUrls),
        completedDisplayTools: completedDisplayToolResults,
        messageId,
        metadata
      })
      const segments = extractToolUIFromText(textContent, messageId)
      for (let si = 0; si < segments.length; si++) {
        const segment = segments[si]
        if (segment.type === 'tool-ui') {
          elements.push(
            <Fragment
              key={`${messageId}-extracted-tool-${index}-${segment.key}`}
            >
              {segment.component}
            </Fragment>
          )
        } else if (segment.content.trim()) {
          // Only show actions on the very last text segment of the last text part
          const isLastSegment = si === segments.length - 1
          const showActionsHere = shouldShowActions && isLastSegment
          if (showActionsHere) actionsShownInline = true
          lastTextContent = segment.content
          elements.push(
            <AnswerSection
              key={`${messageId}-text-${index}-${si}`}
              content={segment.content}
              isOpen={getIsOpen(
                messageId,
                part.type,
                index < renderParts.length - 1
              )}
              onOpenChange={open => onOpenChange(messageId, open)}
              chatId={chatId}
              showActions={showActionsHere}
              messageId={messageId}
              metadata={metadata}
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
      if (!renderedTodoWrite) {
        renderedTodoWrite = true
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
      part.type === 'tool-createCanvasArtifact' ||
      part.type === 'tool-updateCanvasArtifact'
    ) {
      // Canvas artifact tool parts — render card with onClick or suppress
      const toolPart = part as { state?: string; output?: unknown }
      if (toolPart.state === 'output-available' && toolPart.output) {
        const output = toolPart.output as { artifactId?: unknown }
        // Skip failed creation attempts with no persisted artifact (artifactId
        // is '' when compile fails before DB insert — these are transient
        // failures the AI will retry, not something to surface in the chat).
        if (typeof output.artifactId !== 'string' || !output.artifactId) {
          return
        }
        if (latestPersistedCanvasArtifactPartIndexes.has(output.artifactId)) {
          return // Already rendered via data-canvasArtifact — skip
        }
        // No matching data part — render card with onClick
        const cardData = tryParseCanvasArtifactCardData(toolPart.output)
        if (cardData) {
          const latestStatus = latestCanvasArtifactStatuses.get(
            cardData.artifactId
          )
          const latestStatusOverride =
            latestStatus && latestStatus.sourceIndex > index
              ? latestStatus
              : undefined
          flushBuffer(`seg-${index}`)
          elements.push(
            <CanvasArtifactCard
              key={`${messageId}-canvas-tool-${index}`}
              data={
                latestStatusOverride
                  ? {
                      ...cardData,
                      status: latestStatusOverride.status,
                      draftRevision: latestStatusOverride.draftRevision,
                      currentVersionId: latestStatusOverride.currentVersionId
                    }
                  : cardData
              }
              onClick={
                onCanvasArtifactClick
                  ? () => onCanvasArtifactClick(cardData.artifactId)
                  : undefined
              }
            />
          )
          return
        }
      }
      // Input-streaming/input-available or unparseable — push to buffer
      buffer.push(part)
    } else if (part.type === 'data-canvasArtifact') {
      // Render a clickable canvas artifact card
      flushBuffer(`seg-${index}`)
      const canvasData = (part as { data?: CanvasArtifactData }).data
      if (
        canvasData?.artifactId &&
        latestPersistedCanvasArtifactPartIndexes.get(canvasData.artifactId) ===
          index
      ) {
        const latestStatus = latestCanvasArtifactStatuses.get(
          canvasData.artifactId
        )
        const latestStatusOverride =
          latestStatus && latestStatus.sourceIndex > index
            ? latestStatus
            : undefined
        elements.push(
          <CanvasArtifactCard
            key={`${messageId}-canvas-artifact-${index}`}
            data={
              latestStatusOverride
                ? {
                    ...canvasData,
                    status: latestStatusOverride.status,
                    draftRevision: latestStatusOverride.draftRevision,
                    currentVersionId: latestStatusOverride.currentVersionId
                  }
                : canvasData
            }
            onClick={
              onCanvasArtifactClick
                ? () => onCanvasArtifactClick(canvasData.artifactId)
                : undefined
            }
          />
        )
      }
    } else if (part.type === 'data-canvasArtifactStatus') {
      // Status updates don't render a visible element in chat
      // (the card already shows the latest status)
    } else if ((part.type as string) === 'data-artifact') {
      // Legacy artifact parts — render a notice card
      flushBuffer(`seg-${index}`)
      const legacyData = (part as { data?: { id?: string } }).data
      const legacyId = legacyData?.id ?? 'unknown'
      elements.push(
        <button
          key={`${messageId}-legacy-artifact-${index}`}
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-card p-3 text-left text-sm text-muted-foreground"
          onClick={
            onLegacyArtifactClick
              ? () => onLegacyArtifactClick(legacyId)
              : undefined
          }
          data-testid="legacy-artifact-notice"
          data-artifact-id={legacyId}
        >
          This artifact was created with a previous system and is no longer
          available.
        </button>
      )
    } else if (part.type === 'tool-generateImage') {
      const toolPart = part as { state?: string; output?: unknown }
      if (toolPart.state === 'output-available' && toolPart.output) {
        const parsed = safeParseSerializableGenerateImage(toolPart.output)
        if (parsed) {
          flushBuffer(`seg-${index}`)
          elements.push(
            <GenerateImage
              key={`${messageId}-generate-image-${index}`}
              {...parsed}
            />
          )
          return
        }
      }
      // Streaming/pending state — push to buffer for process section
      buffer.push(part)
    } else if (
      part.type === 'reasoning' ||
      part.type?.startsWith?.('tool-') ||
      part.type?.startsWith?.('data-')
    ) {
      buffer.push(part)
    } else if (part.type === 'dynamic-tool') {
      flushBuffer(`seg-${index}`)
      const dynamicToolPart = part as DynamicToolPart
      if (
        (dynamicToolPart.toolName === 'createCanvasArtifact' ||
          dynamicToolPart.toolName === 'updateCanvasArtifact') &&
        dynamicToolPart.state === 'output-available' &&
        dynamicToolPart.output &&
        typeof dynamicToolPart.output === 'object'
      ) {
        const output = dynamicToolPart.output as { artifactId?: unknown }
        // Skip failed creation attempts with no persisted artifact
        if (typeof output.artifactId !== 'string' || !output.artifactId) {
          return
        }
        if (latestPersistedCanvasArtifactPartIndexes.has(output.artifactId)) {
          return // Already rendered via data-canvasArtifact — skip
        }
        // Render card directly with onClick wired up
        const cardData = tryParseCanvasArtifactCardData(dynamicToolPart.output)
        if (cardData) {
          const latestStatus = latestCanvasArtifactStatuses.get(
            cardData.artifactId
          )
          const latestStatusOverride =
            latestStatus && latestStatus.sourceIndex > index
              ? latestStatus
              : undefined
          elements.push(
            <CanvasArtifactCard
              key={`${messageId}-dynamic-tool-${index}`}
              data={
                latestStatusOverride
                  ? {
                      ...cardData,
                      status: latestStatusOverride.status,
                      draftRevision: latestStatusOverride.draftRevision,
                      currentVersionId: latestStatusOverride.currentVersionId
                    }
                  : cardData
              }
              onClick={
                onCanvasArtifactClick
                  ? () => onCanvasArtifactClick(cardData.artifactId)
                  : undefined
              }
            />
          )
          return
        }
      }
      elements.push(
        <DynamicToolDisplay
          key={`${messageId}-dynamic-tool-${index}`}
          part={dynamicToolPart}
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

  // If actions weren't shown inline (because visible content like cards
  // appeared after the last text), render them at the very end.
  if (!actionsShownInline && lastTextContent.trim()) {
    const isStreamingComplete = status !== 'streaming' && status !== 'submitted'
    const shouldShow = isLatestMessage ? isStreamingComplete : true
    elements.push(
      <MessageActions
        key={`${messageId}-trailing-actions`}
        message={lastTextContent}
        messageId={messageId}
        traceId={metadata?.traceId}
        feedbackScore={metadata?.feedbackScore}
        chatId={chatId}
        reload={reload ? () => reload(messageId) : undefined}
        status={status}
        visible={shouldShow}
        citationMaps={citationMaps}
      />
    )
  }

  return <>{elements}</>
}
