import { z } from 'zod'

export const toolName = 'displayCallout' as const

export const inputSchema = z.object({
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

export const outputSchema = inputSchema

export type DisplayCalloutInput = z.infer<typeof inputSchema>
export type DisplayCalloutOutput = z.infer<typeof outputSchema>
