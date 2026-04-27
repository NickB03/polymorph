import { z } from 'zod'

export const toolName = 'readCanvasArtifact' as const

export const inputSchema = z.object({
  artifactId: z.string().min(1).describe('ID of the artifact to read')
})

export const outputSchema = z.object({
  artifactId: z.string(),
  chatId: z.string(),
  title: z.string(),
  status: z.string(),
  draftRevision: z.number(),
  currentVersionId: z.string().nullable(),
  files: z.record(z.string(), z.string()),
  error: z.string().optional(),
  errorCode: z.string().optional()
})

export const ReadCanvasArtifactSchema = inputSchema

export type ReadCanvasArtifactInput = z.infer<typeof inputSchema>
export type ReadCanvasArtifactOutput = z.infer<typeof outputSchema>
