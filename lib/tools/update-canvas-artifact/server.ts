import { tool } from 'ai'

import { refreshGuestCanvasToken } from '@/lib/canvas/guest-token'
import {
  loadCanvasArtifactState,
  saveCanvasArtifactVersion,
  updateCanvasArtifactDraftFromSource
} from '@/lib/canvas/service'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import type { CanvasSourceFiles } from '@/lib/types/canvas'

import type { UpdateCanvasArtifactOutput } from './schema'
import { inputSchema } from './schema'

/**
 * Create an update canvas artifact tool bound to a request-scoped context.
 *
 * The tool:
 * 1. Emits `data-canvasArtifactStatus` with `status: 'generating'` immediately
 * 2. Loads the latest persisted `draftSource` and `draftRevision`
 * 3. Calls `updateCanvasArtifactDraftFromSource()` from the service layer
 * 4. If stale revision: returns a conflict result
 * 5. Auto-creates a version (createdBy: 'ai')
 * 6. Emits results
 * 7. If guest: includes rotated `guestCanvasToken` in the status part
 */
export function updateCanvasArtifactTool(ctx: CanvasToolContext) {
  return tool({
    description:
      'Update the existing canvas artifact for this chat. Provide the full replacement source file set and the baseRevision you are updating from. The update will fail if the baseRevision is stale.',
    inputSchema,
    execute: async ({ artifactId, baseRevision, files }) => {
      const draftSource = files as CanvasSourceFiles

      console.log(
        `[updateCanvasArtifact] Tool invoked: chatId=${ctx.chatId}, artifactId=${artifactId}, baseRevision=${baseRevision}, files=[${Object.keys(draftSource).join(', ')}]`
      )

      ctx.emitter.emitCanvasArtifactStatus({
        artifactId,
        chatId: ctx.chatId,
        status: 'generating',
        draftRevision: baseRevision,
        currentVersionId: null,
        updatedAt: new Date().toISOString()
      })

      const currentState = await loadCanvasArtifactState({
        artifactId,
        userId: ctx.userId
      })

      if (!currentState) {
        return {
          artifactId,
          chatId: ctx.chatId,
          title: 'Canvas Artifact',
          status: 'compile_failed',
          draftRevision: baseRevision,
          currentVersionId: null,
          error: 'Artifact not found',
          errorCode: 'not-found'
        } satisfies UpdateCanvasArtifactOutput
      }

      const result = await updateCanvasArtifactDraftFromSource({
        artifactId,
        expectedRevision: baseRevision,
        draftSource,
        title: currentState.title,
        userId: ctx.userId,
        onProgress: payload =>
          ctx.emitter.emitCanvasArtifactEvent({
            artifactId: payload.artifactId,
            event: 'compile-progress',
            payload
          })
      })

      if (!result.ok && result.errorCode === 'stale-revision') {
        const latest = await loadCanvasArtifactState({
          artifactId,
          userId: ctx.userId
        })
        if (latest) {
          ctx.emitter.emitCanvasArtifactStatus({
            artifactId,
            chatId: ctx.chatId,
            status: latest.status,
            draftRevision: latest.draftRevision,
            currentVersionId: latest.currentVersionId,
            updatedAt: latest.updatedAt
          })
        }
        return {
          artifactId,
          chatId: latest?.chatId ?? currentState.chatId,
          title: latest?.title ?? currentState.title,
          status: latest?.status ?? currentState.status,
          draftRevision: latest?.draftRevision ?? currentState.draftRevision,
          currentVersionId:
            latest?.currentVersionId ?? currentState.currentVersionId,
          error: result.error,
          errorCode: result.errorCode
        } satisfies UpdateCanvasArtifactOutput
      }

      if (!result.ok || !result.artifact) {
        console.error(
          `[updateCanvasArtifact] Failed: chatId=${ctx.chatId}, artifactId=${artifactId}, error=${result.error}, errorCode=${result.errorCode}`
        )
        if (result.artifact?.status === 'compile_failed') {
          let guestCanvasToken: string | undefined
          if (ctx.isGuest) {
            guestCanvasToken = await refreshGuestCanvasToken({
              chatId: result.artifact.chatId,
              artifactId: result.artifact.artifactId
            })
          }

          ctx.emitter.emitCanvasArtifactStatus({
            artifactId: result.artifact.artifactId,
            chatId: result.artifact.chatId,
            status: 'compile_failed',
            draftRevision: result.artifact.draftRevision,
            currentVersionId: result.artifact.currentVersionId,
            updatedAt: result.artifact.updatedAt,
            ...(guestCanvasToken ? { guestCanvasToken } : {})
          })
        }
        return {
          artifactId,
          chatId: currentState.chatId,
          title: currentState.title,
          status: 'compile_failed',
          draftRevision: baseRevision,
          currentVersionId: currentState.currentVersionId,
          error: result.error ?? 'Failed to update artifact',
          errorCode: result.errorCode
        } satisfies UpdateCanvasArtifactOutput
      }

      const artifact = result.artifact

      console.log(
        `[updateCanvasArtifact] Success: chatId=${ctx.chatId}, artifactId=${artifactId}, status=${artifact.status}`
      )

      if (artifact.status === 'ready') {
        const versionResult = await saveCanvasArtifactVersion({
          artifactId,
          createdBy: 'ai',
          userId: ctx.userId
        })

        if (versionResult.ok && versionResult.artifact) {
          const versioned = versionResult.artifact

          ctx.emitter.emitCanvasArtifact({
            artifactId: versioned.artifactId,
            chatId: versioned.chatId,
            title: versioned.title,
            status: versioned.status,
            draftRevision: versioned.draftRevision,
            currentVersionId: versioned.currentVersionId
          })

          let guestCanvasToken: string | undefined
          if (ctx.isGuest) {
            guestCanvasToken = await refreshGuestCanvasToken({
              chatId: ctx.chatId,
              artifactId
            })
          }

          ctx.emitter.emitCanvasArtifactStatus({
            artifactId: versioned.artifactId,
            chatId: versioned.chatId,
            status: versioned.status,
            draftRevision: versioned.draftRevision,
            currentVersionId: versioned.currentVersionId,
            updatedAt: versioned.updatedAt,
            ...(guestCanvasToken ? { guestCanvasToken } : {})
          })

          return {
            artifactId: versioned.artifactId,
            chatId: versioned.chatId,
            title: versioned.title,
            status: versioned.status,
            draftRevision: versioned.draftRevision,
            currentVersionId: versioned.currentVersionId
          } satisfies UpdateCanvasArtifactOutput
        }
      }

      ctx.emitter.emitCanvasArtifact({
        artifactId: artifact.artifactId,
        chatId: artifact.chatId,
        title: artifact.title,
        status: artifact.status,
        draftRevision: artifact.draftRevision,
        currentVersionId: artifact.currentVersionId
      })

      let guestCanvasToken: string | undefined
      if (ctx.isGuest) {
        guestCanvasToken = await refreshGuestCanvasToken({
          chatId: ctx.chatId,
          artifactId
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
        title: artifact.title,
        status: artifact.status,
        draftRevision: artifact.draftRevision,
        currentVersionId: artifact.currentVersionId
      } satisfies UpdateCanvasArtifactOutput
    }
  })
}

export const serverTool = updateCanvasArtifactTool
