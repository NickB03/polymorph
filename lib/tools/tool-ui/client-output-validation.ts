import type { UIMessage } from '@/lib/types/ai'

import { createToolUiServerTools } from './server-catalog'

type ToolPart = NonNullable<UIMessage['parts']>[number]

type OutputSchemaParseResult =
  | { success: true; data: unknown }
  | { success: false; error: { message: string } }

type ToolWithOptionalOutputSchema = {
  outputSchema?: {
    safeParse: (value: unknown) => OutputSchemaParseResult
  }
}

const toolUiServerTools = createToolUiServerTools() as unknown as Record<
  string,
  ToolWithOptionalOutputSchema
>

export type ClientOutputValidationResult =
  | { success: true; output: unknown }
  | { success: false; toolName: string; message: string }

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
  const outputSchema = toolName
    ? toolUiServerTools[toolName]?.outputSchema
    : null

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

  return { success: true, output: parsed.data }
}
