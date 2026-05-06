'use client'

import type { ReactNode } from 'react'

import { ResearchStatusLine } from '@/components/research-status-line'
import { OptionList } from '@/components/tool-ui/option-list/option-list'
import type { OptionListSelection } from '@/components/tool-ui/option-list/schema'
import { safeParseSerializableOptionList } from '@/components/tool-ui/option-list/schema'

type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

type DisplayToolPart = {
  state?: ToolPartState
  input?: unknown
  output?: unknown
  toolCallId?: string
  errorText?: string
}

type RenderToolPartArgs = {
  toolPart: DisplayToolPart
  messageId: string
  partIndex: number
  status?: string
  submitInteractiveToolOutput?: (params: {
    toolCallId: string
    output: unknown
  }) => void
}

function renderLoadingToolPlaceholder(messageId: string, partIndex: number) {
  return (
    <div
      key={`${messageId}-display-tool-${partIndex}`}
      className="h-24 animate-pulse rounded-lg bg-muted"
    />
  )
}

export function renderToolPart({
  toolPart,
  messageId,
  partIndex,
  status,
  submitInteractiveToolOutput
}: RenderToolPartArgs): ReactNode | null {
  if (toolPart.state === 'output-available') {
    const parsed = safeParseSerializableOptionList(toolPart.input)
    if (!parsed) return null

    if (parsed.id === 'research-depth') {
      const selectedOption = parsed.options.find(
        opt => opt.id === toolPart.output
      )
      return (
        <ResearchStatusLine
          key={`${messageId}-display-tool-${partIndex}`}
          selectedLabel={selectedOption?.label ?? 'Research'}
          isStreaming={Boolean(
            status === 'streaming' || status === 'submitted'
          )}
        />
      )
    }

    return (
      <OptionList
        key={`${messageId}-display-tool-${partIndex}`}
        {...parsed}
        choice={toolPart.output as OptionListSelection}
      />
    )
  }

  if (toolPart.state === 'input-available') {
    const parsed = safeParseSerializableOptionList(toolPart.input)
    if (!parsed) return null

    return (
      <OptionList
        key={`${messageId}-display-tool-${partIndex}`}
        {...parsed}
        onAction={(_actionId, selection) => {
          if (toolPart.toolCallId) {
            submitInteractiveToolOutput?.({
              toolCallId: toolPart.toolCallId,
              output: selection
            })
          }
        }}
      />
    )
  }

  return renderLoadingToolPlaceholder(messageId, partIndex)
}
