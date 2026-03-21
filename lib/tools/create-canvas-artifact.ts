import { tool } from 'ai'
import { z } from 'zod'

import { CANVAS_ALLOWED_FILES } from '@/lib/canvas/constants'
import { refreshGuestCanvasToken } from '@/lib/canvas/guest-token'
import {
  type CanvasServiceResult,
  createCanvasArtifactFromSource
} from '@/lib/canvas/service'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import { canvasFilesSchema } from '@/lib/tools/canvas-file-schema'
import type { CanvasSourceFiles } from '@/lib/types/canvas'

export const CreateCanvasArtifactSchema = z.object({
  title: z
    .string()
    .optional()
    .describe('Human-readable title for the artifact'),
  files: canvasFilesSchema.describe(
    `Full virtual file set. Keys must be allowed file names (${CANVAS_ALLOWED_FILES.join(', ')}). App.tsx is required; other files are optional.`
  )
})

export type CreateCanvasArtifactInput = z.infer<
  typeof CreateCanvasArtifactSchema
>

export type CreateCanvasArtifactOutput = {
  artifactId: string
  chatId: string
  status: string
  draftRevision: number
  currentVersionId: string | null
  error?: string
  errorCode?: string
}

/**
 * Create a canvas artifact tool bound to a request-scoped context.
 *
 * The tool:
 * 1. Emits `data-canvasArtifactStatus` with `status: 'generating'` immediately
 * 2. Calls `createCanvasArtifactFromSource()` from the service layer
 * 3. If the chat already has an artifact, returns a structured conflict
 * 4. Emits `data-canvasArtifact` with the result
 * 5. Emits `data-canvasArtifactStatus` with the final status
 * 6. If guest: includes rotated `guestCanvasToken` in the status part
 */
export function createCanvasArtifactTool(ctx: CanvasToolContext) {
  return tool({
    description:
      'Create a new interactive web artifact for this chat. Provide the full source file set (App.tsx is required). Only one artifact per chat is allowed — use updateCanvasArtifact to modify an existing one.',
    inputSchema: CreateCanvasArtifactSchema,
    execute: async ({ title, files }) => {
      const draftSource = files as CanvasSourceFiles

      // Emit generating status immediately so the UI can show a loading state
      ctx.emitter.emitCanvasArtifactStatus({
        artifactId: '',
        chatId: ctx.chatId,
        status: 'generating',
        draftRevision: 0,
        currentVersionId: null,
        updatedAt: new Date().toISOString()
      })

      const result: CanvasServiceResult = await createCanvasArtifactFromSource({
        chatId: ctx.chatId,
        userId: ctx.userId,
        title,
        draftSource
      })

      // Handle conflict: chat already has an artifact
      if (!result.ok && result.errorCode === 'artifact-already-exists') {
        const existing = result.artifact
        if (existing) {
          ctx.emitter.emitCanvasArtifactStatus({
            artifactId: existing.artifactId,
            chatId: existing.chatId,
            status: existing.status,
            draftRevision: existing.draftRevision,
            currentVersionId: existing.currentVersionId,
            updatedAt: existing.updatedAt
          })
        }
        return {
          artifactId: existing?.artifactId ?? '',
          chatId: ctx.chatId,
          status: existing?.status ?? 'ready',
          draftRevision: existing?.draftRevision ?? 0,
          currentVersionId: existing?.currentVersionId ?? null,
          error: result.error,
          errorCode: result.errorCode
        } satisfies CreateCanvasArtifactOutput
      }

      // Handle other failures — include artifact info if it was partially created
      if (!result.ok) {
        return {
          artifactId: result.artifact?.artifactId ?? '',
          chatId: ctx.chatId,
          status: result.artifact?.status ?? 'compile_failed',
          draftRevision: result.artifact?.draftRevision ?? 0,
          currentVersionId: result.artifact?.currentVersionId ?? null,
          error: result.error ?? 'Failed to create artifact',
          errorCode: result.errorCode
        } satisfies CreateCanvasArtifactOutput
      }

      if (!result.artifact) {
        return {
          artifactId: '',
          chatId: ctx.chatId,
          status: 'compile_failed',
          draftRevision: 0,
          currentVersionId: null,
          error: 'No artifact was created',
          errorCode: result.errorCode
        } satisfies CreateCanvasArtifactOutput
      }

      const artifact = result.artifact

      // Emit the persisted artifact data
      ctx.emitter.emitCanvasArtifact({
        artifactId: artifact.artifactId,
        chatId: artifact.chatId,
        title: artifact.title,
        status: artifact.status,
        draftRevision: artifact.draftRevision,
        currentVersionId: artifact.currentVersionId
      })

      // Build final status with optional guest token
      let guestCanvasToken: string | undefined
      if (ctx.isGuest) {
        guestCanvasToken = await refreshGuestCanvasToken({
          chatId: ctx.chatId,
          artifactId: artifact.artifactId
        })
      }

      ctx.emitter.emitCanvasArtifactStatus({
        artifactId: artifact.artifactId,
        chatId: artifact.chatId,
        status: artifact.status,
        draftRevision: artifact.draftRevision,
        currentVersionId: artifact.currentVersionId,
        updatedAt: artifact.updatedAt,
        ...(guestCanvasToken ? { guestCanvasToken } : {})
      })

      return {
        artifactId: artifact.artifactId,
        chatId: artifact.chatId,
        status: artifact.status,
        draftRevision: artifact.draftRevision,
        currentVersionId: artifact.currentVersionId
      } satisfies CreateCanvasArtifactOutput
    }
  })
}
