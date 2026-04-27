'use client'

import { Fragment, type ReactNode } from 'react'

import { UseChatHelpers } from '@ai-sdk/react'

import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'

import { ResearchStatusLine } from '../research-status-line'

import { OptionList } from './option-list/option-list'
import type { OptionListSelection } from './option-list/schema'
import { safeParseSerializableOptionList } from './option-list/schema'
import { QuestionWizard } from './question-wizard/question-wizard'
import type { WizardResult } from './question-wizard/schema'
import { safeParseSerializableQuestionWizard } from './question-wizard/schema'
import { tryRenderToolUIByName } from './registry'

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
  toolName: string
  toolPart: DisplayToolPart
  messageId: string
  partIndex: number
  isResearchMode: boolean
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
}

function renderUnavailableToolOutput(
  messageId: string,
  partIndex: number,
  toolName: string
) {
  return (
    <div
      key={`${messageId}-display-tool-${partIndex}`}
      className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
    >
      {toolName} output could not be rendered
    </div>
  )
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
  toolName,
  toolPart,
  messageId,
  partIndex,
  isResearchMode,
  status,
  addToolResult
}: RenderToolPartArgs): ReactNode | null {
  if (
    isResearchMode &&
    (toolName === 'displayCitations' || toolName === 'displayLinkPreview')
  ) {
    return (
      <span key={`${messageId}-display-tool-${partIndex}`} className="sr-only">
        Citations available in research activity panel
      </span>
    )
  }

  if (toolName === 'displayOptionList') {
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
              addToolResult?.({
                toolCallId: toolPart.toolCallId,
                result: selection
              })
            }
          }}
        />
      )
    }

    return renderLoadingToolPlaceholder(messageId, partIndex)
  }

  if (toolName === 'displayQuestionWizard') {
    if (toolPart.state === 'output-available') {
      const parsed = safeParseSerializableQuestionWizard(toolPart.input)
      if (!parsed) return null

      return (
        <QuestionWizard
          key={`${messageId}-display-tool-${partIndex}`}
          {...parsed}
          choice={toolPart.output as WizardResult}
        />
      )
    }

    if (toolPart.state === 'input-available') {
      const parsed = safeParseSerializableQuestionWizard(toolPart.input)
      if (!parsed) return null

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

    return renderLoadingToolPlaceholder(messageId, partIndex)
  }

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
      renderUnavailableToolOutput(messageId, partIndex, toolName)
    )
  }

  if (toolPart.state === 'output-error') {
    return renderUnavailableToolOutput(messageId, partIndex, toolName)
  }

  if (
    toolPart.state === 'input-streaming' ||
    toolPart.state === 'input-available'
  ) {
    return renderLoadingToolPlaceholder(messageId, partIndex)
  }

  return null
}
