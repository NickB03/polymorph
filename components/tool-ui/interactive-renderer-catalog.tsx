'use client'

import type { ReactNode } from 'react'

import { renderToolPart as renderDisplayOptionListToolPart } from '@/lib/tools/display-option-list/client'
import { toolName as displayOptionListToolName } from '@/lib/tools/display-option-list/schema'
import { renderToolPart as renderDisplayQuestionWizardToolPart } from '@/lib/tools/display-question-wizard/client'
import { toolName as displayQuestionWizardToolName } from '@/lib/tools/display-question-wizard/schema'

type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

export type DisplayToolPart = {
  state?: ToolPartState
  input?: unknown
  output?: unknown
  toolCallId?: string
  errorText?: string
}

export type RenderInteractiveToolPartArgs = {
  toolName: string
  toolPart: DisplayToolPart
  messageId: string
  partIndex: number
  status?: string
  submitInteractiveToolOutput?: (params: {
    toolCallId: string
    output: unknown
  }) => void
}

export type InteractiveToolRendererEntry = {
  name: string
  render: (args: RenderInteractiveToolPartArgs) => ReactNode | null
}

export const interactiveToolRendererEntries = [
  {
    name: displayOptionListToolName,
    render: args => renderDisplayOptionListToolPart(args)
  },
  {
    name: displayQuestionWizardToolName,
    render: args => renderDisplayQuestionWizardToolPart(args)
  }
] as const satisfies readonly InteractiveToolRendererEntry[]

const interactiveToolRendererByName: ReadonlyMap<
  string,
  InteractiveToolRendererEntry
> = new Map(interactiveToolRendererEntries.map(entry => [entry.name, entry]))

export function tryRenderInteractiveToolPart(
  args: RenderInteractiveToolPartArgs
): ReactNode | null {
  return interactiveToolRendererByName.get(args.toolName)?.render(args) ?? null
}
