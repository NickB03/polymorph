import { z } from 'zod'

export const toolName = 'displayCitations' as const

export const citationSchema = z.object({
  id: z.string().min(1).describe('Unique citation identifier'),
  href: z.string().url().describe('Source URL'),
  title: z.string().describe('Source title'),
  snippet: z.string().optional().describe('Brief excerpt from the source'),
  domain: z.string().optional().describe('Source domain name'),
  favicon: z.string().url().optional().describe('Favicon URL'),
  author: z.string().optional().describe('Author name'),
  publishedAt: z
    .string()
    .datetime()
    .optional()
    .describe('Publication date in ISO format'),
  type: z
    .enum(['webpage', 'document', 'article', 'api', 'code', 'other'])
    .optional()
    .describe('Type of source')
})

export const inputSchema = z.object({
  citations: z
    .array(citationSchema)
    .min(1)
    .describe('Array of citation objects to display')
})

export const outputSchema = inputSchema

export type DisplayCitationsInput = z.infer<typeof inputSchema>
export type DisplayCitationsOutput = z.infer<typeof outputSchema>
