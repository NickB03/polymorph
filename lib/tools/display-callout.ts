import { tool } from 'ai'
import { z } from 'zod'

const DisplayCalloutSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this callout'),
  variant: z
    .enum(['info', 'warning', 'tip', 'success', 'error', 'definition'])
    .describe(
      'Visual style: "info" for general highlights, "warning" for cautions/deprecations, "tip" for pro tips/best practices, "success" for confirmations, "error" for critical issues, "definition" for key term definitions'
    ),
  title: z
    .string()
    .optional()
    .describe(
      'Short heading for the callout (omit for simple single-line notes)'
    ),
  content: z
    .string()
    .min(1)
    .describe('The callout body text. Keep to 1-3 sentences')
})

export const displayCalloutTool = tool({
  description:
    'Display a styled callout box to highlight critical information. Use for warnings (deprecated APIs, breaking changes), tips (best practices, pro tips), definitions (key term explanations), success confirmations, error alerts, or important notes that should stand out from the main text. Keep content concise — one to three sentences.',
  inputSchema: DisplayCalloutSchema,
  execute: async params => params
})
