import { DeepPartial } from 'ai'
import { z } from 'zod'

export const toolName = 'fetch' as const

export const inputSchema = z.object({
  url: z.string().describe('The URL to retrieve content from'),
  type: z
    .enum(['regular', 'api'])
    .default('regular')
    .describe(
      'Fetch method: "regular" (default) = fast direct HTML fetch for simple web pages (does NOT support PDFs), "api" = advanced extraction for PDFs and complex JavaScript-rendered pages (requires Jina or Tavily API keys)'
    )
})

export const outputSchema = z
  .object({
    results: z.array(
      z
        .object({
          title: z.string(),
          content: z.string(),
          url: z.string()
        })
        .passthrough()
    ),
    query: z.string().optional(),
    images: z.array(z.unknown()).optional()
  })
  .passthrough()

export const fetchSchema = inputSchema

export type FetchInput = z.infer<typeof inputSchema>
export type FetchOutput = z.infer<typeof outputSchema>
export type PartialInquiry = DeepPartial<typeof inputSchema>
