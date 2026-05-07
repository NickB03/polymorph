import { type FlexibleSchema, type Tool, tool } from 'ai'

export function createPassthroughDisplayTool<TInput>(args: {
  description: string
  inputSchema: FlexibleSchema<TInput>
}): Tool<TInput, TInput>
export function createPassthroughDisplayTool({
  description,
  inputSchema
}: {
  description: string
  inputSchema: FlexibleSchema<unknown>
}) {
  return tool({
    description,
    inputSchema,
    execute: async params => params
  })
}

export function createClientResolvedDisplayTool<TInput, TOutput>(args: {
  description: string
  inputSchema: FlexibleSchema<TInput>
  outputSchema: FlexibleSchema<TOutput>
}): Tool<TInput, TOutput>
export function createClientResolvedDisplayTool({
  description,
  inputSchema,
  outputSchema
}: {
  description: string
  inputSchema: FlexibleSchema<unknown>
  outputSchema: FlexibleSchema<unknown>
}) {
  return tool({
    description,
    inputSchema,
    outputSchema
  })
}
