import { tool } from 'ai'
import { z } from 'zod'

const DisplayCodeBlockSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this code block'),
  code: z.string().describe('Full source code to display'),
  language: z
    .string()
    .min(1)
    .optional()
    .describe('Language hint for the code snippet, such as tsx or css'),
  filename: z
    .string()
    .min(1)
    .optional()
    .describe('Filename label shown in the code block header'),
  lineNumbers: z
    .boolean()
    .optional()
    .describe('Whether to show line numbers beside the code'),
  highlightLines: z
    .array(z.number().int().positive())
    .optional()
    .describe('1-based line numbers to visually highlight'),
  maxCollapsedLines: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Optional line cap before the UI collapses the block')
})

export const displayCodeBlockTool = tool({
  description:
    'Display a source code file inline as a rich code block. Use only in canvas artifact inspection or update flows after reading the current artifact, and keep inspection turns focused on 1 to 2 relevant files.',
  inputSchema: DisplayCodeBlockSchema,
  execute: async params => params
})
