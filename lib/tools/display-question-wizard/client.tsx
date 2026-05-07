'use client'

import type { ReactNode } from 'react'

import { QuestionWizard } from '@/components/tool-ui/question-wizard/question-wizard'
import type { WizardResult } from '@/components/tool-ui/question-wizard/schema'
import { safeParseSerializableQuestionWizard } from '@/components/tool-ui/question-wizard/schema'

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
  submitInteractiveToolOutput
}: RenderToolPartArgs): ReactNode | null {
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
