import { tool } from 'ai'
import { z } from 'zod'

const DisplayCodeDiffSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this code diff'),
  oldCode: z.string().describe('Previous full file contents'),
  newCode: z.string().describe('Updated full file contents'),
  language: z
    .string()
    .min(1)
    .optional()
    .describe('Language hint for the file, such as tsx or css'),
  filename: z
    .string()
    .min(1)
    .optional()
    .describe('Filename label shown in the diff header'),
  lineNumbers: z
    .boolean()
    .optional()
    .describe('Whether to show line numbers beside the diff'),
  diffStyle: z
    .enum(['side-by-side', 'unified'])
    .optional()
    .describe('Visual diff layout: side-by-side or unified'),
  maxCollapsedLines: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Optional row cap before the UI collapses the diff')
})

export const displayCodeDiffTool = tool({
  description:
    'Display file changes inline as a rich code diff. Use only in canvas artifact update flows, after reading current files when needed and before calling updateCanvasArtifact with the full replacement file set.',
  inputSchema: DisplayCodeDiffSchema,
  execute: async params => params
})
