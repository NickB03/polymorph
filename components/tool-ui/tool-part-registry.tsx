'use client'

import { Fragment, type ReactNode } from 'react'

import { UseChatHelpers } from '@ai-sdk/react'

import { renderToolPart as renderDisplayOptionListToolPart } from '@/lib/tools/display-option-list/client'
import { toolName as displayOptionListToolName } from '@/lib/tools/display-option-list/schema'
import { renderToolPart as renderDisplayQuestionWizardToolPart } from '@/lib/tools/display-question-wizard/client'
import { toolName as displayQuestionWizardToolName } from '@/lib/tools/display-question-wizard/schema'
import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'

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
  submitInteractiveToolOutput?: (params: {
    toolCallId: string
    output: unknown
  }) => void
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
  submitInteractiveToolOutput
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

  if (toolName === displayOptionListToolName) {
    return renderDisplayOptionListToolPart({
      toolPart,
      messageId,
      partIndex,
      status,
      submitInteractiveToolOutput
    })
  }

  if (toolName === displayQuestionWizardToolName) {
    return renderDisplayQuestionWizardToolPart({
      toolPart,
      messageId,
      partIndex,
      submitInteractiveToolOutput
    })
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
