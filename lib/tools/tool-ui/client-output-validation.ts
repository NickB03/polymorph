import type { UIMessage } from '@/lib/types/ai'

import { toolName as displayOptionListToolName } from '../display-option-list/schema'
import { toolName as displayQuestionWizardToolName } from '../display-question-wizard/schema'

import { createToolUiServerTools } from './server-catalog'

type ToolPart = NonNullable<UIMessage['parts']>[number]

type SchemaParseResult =
  | { success: true; data: unknown }
  | { success: false; error: { message: string } }

type ToolWithOptionalSchemas = {
  inputSchema?: {
    safeParse: (value: unknown) => SchemaParseResult
  }
  outputSchema?: {
    safeParse: (value: unknown) => SchemaParseResult
  }
}

const toolUiServerTools = createToolUiServerTools() as unknown as Record<
  string,
  ToolWithOptionalSchemas
>

export type ClientOutputValidationResult =
  | { success: true; output: unknown }
  | { success: false; toolName: string; message: string }

type OptionListInput = {
  options: Array<{ id: string }>
  selectionMode?: 'single' | 'multi'
  minSelections?: number
  maxSelections?: number
}

type QuestionWizardInput = {
  steps: Array<
    OptionListInput & {
      id: string
    }
  >
}

type SelectionValidationResult =
  | { success: true }
  | { success: false; message: string }

export function getClientResolvedToolName(part: ToolPart): string | null {
  if (
    typeof (part as { type?: unknown }).type === 'string' &&
    (part as { type: string }).type.startsWith('tool-')
  ) {
    return (part as { type: string }).type.slice('tool-'.length)
  }

  if (typeof (part as { toolName?: unknown }).toolName === 'string') {
    return (part as { toolName: string }).toolName
  }

  return null
}

export function validateClientResolvedToolOutput(
  matchedPart: ToolPart,
  output: unknown
): ClientOutputValidationResult {
  const toolName = getClientResolvedToolName(matchedPart)
  const tool = toolName ? toolUiServerTools[toolName] : null
  const outputSchema = tool?.outputSchema

  if (!toolName || !outputSchema) {
    return { success: true, output }
  }

  const parsed = outputSchema.safeParse(output)
  if (!parsed.success) {
    return {
      success: false,
      toolName,
      message: parsed.error.message
    }
  }

  const toolSpecificValidation = validateToolSpecificOutput(
    matchedPart,
    toolName,
    parsed.data,
    tool
  )

  if (!toolSpecificValidation.success) {
    return {
      success: false,
      toolName,
      message: toolSpecificValidation.message
    }
  }

  return { success: true, output: parsed.data }
}

function validateToolSpecificOutput(
  matchedPart: ToolPart,
  toolName: string,
  output: unknown,
  tool: ToolWithOptionalSchemas | null
): SelectionValidationResult {
  if (
    toolName !== displayOptionListToolName &&
    toolName !== displayQuestionWizardToolName
  ) {
    return { success: true }
  }

  const input = getToolPartInput(matchedPart)
  const inputSchema = tool?.inputSchema
  const parsedInput = inputSchema?.safeParse(input)

  if (!parsedInput?.success) {
    return {
      success: false,
      message: parsedInput
        ? `Stored input is invalid: ${parsedInput.error.message}`
        : 'Stored input schema is unavailable'
    }
  }

  if (toolName === displayOptionListToolName) {
    return validateSelectionForInput({
      input: parsedInput.data as OptionListInput,
      output,
      path: 'selection'
    })
  }

  return validateQuestionWizardOutput(
    parsedInput.data as QuestionWizardInput,
    output
  )
}

function getToolPartInput(part: ToolPart): unknown {
  if (typeof part === 'object' && part !== null && 'input' in part) {
    return (part as { input?: unknown }).input
  }

  return undefined
}

function validateQuestionWizardOutput(
  input: QuestionWizardInput,
  output: unknown
): SelectionValidationResult {
  if (!isRecord(output)) {
    return { success: true }
  }

  const stepsById = new Map(input.steps.map(step => [step.id, step]))

  for (const outputStepId of Object.keys(output)) {
    if (!stepsById.has(outputStepId)) {
      return {
        success: false,
        message: `Unknown wizard step id "${outputStepId}"`
      }
    }
  }

  for (const step of input.steps) {
    const hasStepOutput = Object.prototype.hasOwnProperty.call(output, step.id)
    if (!hasStepOutput && getMinSelections(step) > 0) {
      return {
        success: false,
        message: `Missing required wizard step "${step.id}"`
      }
    }

    if (!hasStepOutput) continue

    const stepValidation = validateSelectionForInput({
      input: step,
      output: output[step.id],
      path: `step "${step.id}"`
    })

    if (!stepValidation.success) {
      return stepValidation
    }
  }

  return { success: true }
}

function validateSelectionForInput({
  input,
  output,
  path
}: {
  input: OptionListInput
  output: unknown
  path: string
}): SelectionValidationResult {
  const optionIds = new Set(input.options.map(option => option.id))
  const selectionIds = selectionToIds(output)
  const seenSelectionIds = new Set<string>()

  for (const selectionId of selectionIds) {
    if (!optionIds.has(selectionId)) {
      return {
        success: false,
        message: `${path} contains unknown option id "${selectionId}"`
      }
    }

    if (seenSelectionIds.has(selectionId)) {
      return {
        success: false,
        message: `${path} contains duplicate option id "${selectionId}"`
      }
    }

    seenSelectionIds.add(selectionId)
  }

  const selectedCount = seenSelectionIds.size
  const minSelections = getMinSelections(input)
  const maxSelections = getMaxSelections(input)

  if (selectedCount < minSelections) {
    return {
      success: false,
      message: `${path} requires at least ${minSelections} selection${
        minSelections === 1 ? '' : 's'
      }`
    }
  }

  if (maxSelections !== undefined && selectedCount > maxSelections) {
    return {
      success: false,
      message: `${path} allows at most ${maxSelections} selection${
        maxSelections === 1 ? '' : 's'
      }`
    }
  }

  return { success: true }
}

function selectionToIds(output: unknown): string[] {
  if (output === null) return []
  if (typeof output === 'string') return [output]
  if (Array.isArray(output)) return output
  return []
}

function getMinSelections(input: OptionListInput): number {
  return input.minSelections ?? 1
}

function getMaxSelections(input: OptionListInput): number | undefined {
  return input.selectionMode === 'single' ? 1 : input.maxSelections
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
