'use client'

import { Fragment, type ReactNode } from 'react'

import { UseChatHelpers } from '@ai-sdk/react'

import type { UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'

import {
  type DisplayToolPart,
  tryRenderInteractiveToolPart
} from './interactive-renderer-catalog'
import { tryRenderToolUIByName } from './registry'

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
  toolName: string,
  errorText?: string
) {
  const isError = Boolean(errorText)
  return (
    <div
      key={`${messageId}-display-tool-${partIndex}`}
      className={
        isError
          ? 'rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm'
          : 'rounded-lg border border-dashed p-3 text-sm text-muted-foreground'
      }
    >
      <div className={isError ? 'font-medium text-destructive' : undefined}>
        {isError
          ? `${toolName} failed`
          : `${toolName} output could not be rendered`}
      </div>
      {errorText && (
        <div className="mt-1 text-xs text-muted-foreground">{errorText}</div>
      )}
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

  const interactiveRendered = tryRenderInteractiveToolPart({
    toolName,
    toolPart,
    messageId,
    partIndex,
    status,
    submitInteractiveToolOutput
  })
  if (interactiveRendered) {
    return interactiveRendered
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
    return renderUnavailableToolOutput(
      messageId,
      partIndex,
      toolName,
      toolPart.errorText
    )
  }

  if (
    toolPart.state === 'input-streaming' ||
    toolPart.state === 'input-available'
  ) {
    return renderLoadingToolPlaceholder(messageId, partIndex)
  }

  return null
}
