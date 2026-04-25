import { z } from 'zod'

import { CANVAS_ALLOWED_FILES } from '@/lib/canvas/constants'
import { canvasFilesSchema } from '@/lib/tools/canvas-file-schema'

export const toolName = 'updateCanvasArtifact' as const

export const inputSchema = z.object({
  artifactId: z.string().min(1).describe('ID of the artifact to update'),
  baseRevision: z
    .number()
    .int()
    .min(0)
    .describe(
      'The draft revision number this update is based on. Must match the current revision or the update will fail with a stale-revision conflict.'
    ),
  files: canvasFilesSchema.describe(
    `Full replacement virtual file set. Keys must be allowed file names (${CANVAS_ALLOWED_FILES.join(', ')}). App.tsx is required; other files are optional.`
  )
})

export const outputSchema = z.object({
  artifactId: z.string(),
  chatId: z.string(),
  title: z.string(),
  status: z.string(),
  draftRevision: z.number(),
  currentVersionId: z.string().nullable(),
  error: z.string().optional(),
  errorCode: z.string().optional()
})

export const UpdateCanvasArtifactSchema = inputSchema

export type UpdateCanvasArtifactInput = z.infer<typeof inputSchema>
export type UpdateCanvasArtifactOutput = z.infer<typeof outputSchema>
