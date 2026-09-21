import { tool } from 'ai'

import { loadCanvasArtifactState } from '@/lib/canvas/service'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'

import type { ReadCanvasArtifactOutput } from './schema'
import { inputSchema } from './schema'

/**
 * Read-only tool that returns the current canvas artifact source files.
 * No side effects: no emitter events, no guest token rotation.
 */
export function readCanvasArtifactTool(ctx: CanvasToolContext) {
  return tool({
    description:
      'Read the current source files of the existing canvas artifact. Returns the full file set and metadata. Use this before updating when the artifact source is not in the conversation context.',
    inputSchema,
    execute: async ({ artifactId }) => {
      console.log(
        `[readCanvasArtifact] Tool invoked: chatId=${ctx.chatId}, artifactId=${artifactId}`
      )

      // All guests share one userId, so userId scoping cannot tell guests
      // apart. A guest may only touch the artifact its verified token (or its
      // own create call in this request) bound to the context; anything else
      // is reported as not-found without touching the DB.
      const guestDenied =
        ctx.isGuest && artifactId !== ctx.currentArtifact?.artifactId

      const state = guestDenied
        ? null
        : await loadCanvasArtifactState({
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

export const serverTool = readCanvasArtifactTool
