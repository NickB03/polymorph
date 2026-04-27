import { z } from 'zod'

export const toolName = 'displayLinkPreview' as const

export const inputSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this link preview'),
  href: z.string().url().describe('URL to preview'),
  title: z.string().optional().describe('Link title'),
  description: z.string().optional().describe('Brief description of the link'),
  image: z.string().url().optional().describe('Preview image URL'),
  domain: z.string().optional().describe('Source domain name'),
  favicon: z.string().url().optional().describe('Favicon URL')
})

export const outputSchema = inputSchema

export type DisplayLinkPreviewInput = z.infer<typeof inputSchema>
export type DisplayLinkPreviewOutput = z.infer<typeof outputSchema>
