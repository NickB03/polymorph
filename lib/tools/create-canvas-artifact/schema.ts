import { z } from 'zod'

import { CANVAS_ALLOWED_FILES } from '@/lib/canvas/constants'
import { canvasFilesSchema } from '@/lib/tools/canvas-file-schema'

export const toolName = 'createCanvasArtifact' as const

export const inputSchema = z.object({
  title: z
    .string()
    .optional()
    .describe('Human-readable title for the artifact'),
  files: canvasFilesSchema.describe(
    `Full virtual file set. Keys must be allowed file names (${CANVAS_ALLOWED_FILES.join(', ')}). App.tsx is required; other files are optional.`
  )
})

export const outputSchema = z.object({
  artifactId: z.string(),
  chatId: z.string(),
  status: z.string(),
  draftRevision: z.number(),
  currentVersionId: z.string().nullable(),
  error: z.string().optional(),
  errorCode: z.string().optional()
})

export const CreateCanvasArtifactSchema = inputSchema

export type CreateCanvasArtifactInput = z.infer<typeof inputSchema>
export type CreateCanvasArtifactOutput = z.infer<typeof outputSchema>
