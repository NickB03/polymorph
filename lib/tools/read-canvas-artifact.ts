import { tool } from 'ai'
import { z } from 'zod'

import { loadCanvasArtifactState } from '@/lib/canvas/service'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'

export const ReadCanvasArtifactSchema = z.object({
  artifactId: z.string().min(1).describe('ID of the artifact to read')
})

export type ReadCanvasArtifactInput = z.infer<typeof ReadCanvasArtifactSchema>

export type ReadCanvasArtifactOutput = {
  artifactId: string
  chatId: string
  title: string
  status: string
  draftRevision: number
  currentVersionId: string | null
  files: Record<string, string>
  error?: string
  errorCode?: string
}

/**
 * Read-only tool that returns the current canvas artifact source files.
 * No side effects — no emitter events, no guest token rotation.
 */
export function readCanvasArtifactTool(ctx: CanvasToolContext) {
  return tool({
    description:
      'Read the current source files of the existing canvas artifact. Returns the full file set and metadata. Use this before updating when the artifact source is not in the conversation context.',
    inputSchema: ReadCanvasArtifactSchema,
    execute: async ({ artifactId }) => {
      console.log(
        `[readCanvasArtifact] Tool invoked: chatId=${ctx.chatId}, artifactId=${artifactId}`
      )

      const state = await loadCanvasArtifactState({
        artifactId,
        userId: ctx.userId
      })

      if (!state) {
        return {
          artifactId,
          chatId: ctx.chatId,
          title: '',
          status: 'not_found',
          draftRevision: 0,
          currentVersionId: null,
          files: {} as Record<string, string>,
          error: 'Artifact not found',
          errorCode: 'not-found'
        } satisfies ReadCanvasArtifactOutput
      }

      return {
        artifactId: state.artifactId,
        chatId: state.chatId,
        title: state.title,
        status: state.status,
        draftRevision: state.draftRevision,
        currentVersionId: state.currentVersionId,
        files: state.draftSource as Record<string, string>
      } satisfies ReadCanvasArtifactOutput
    }
  })
}
