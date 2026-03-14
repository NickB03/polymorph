import { tool } from 'ai'
import { z } from 'zod'

import { logArtifactEvent } from '@/lib/artifacts/observability'
import { getArtifactContext } from '@/lib/artifacts/tool-context'

const RestartArtifactPreviewSchema = z.object({
  reason: z
    .string()
    .optional()
    .describe('Why the preview restart was requested')
})

export const restartArtifactPreviewTool = tool({
  description:
    'Restart the live preview of the webapp artifact. Use when the preview is not loading correctly or when the user reports display issues.',
  inputSchema: RestartArtifactPreviewSchema,
  execute: async (params, context) => {
    const startTime = Date.now()
    const artifactCtx = getArtifactContext(context)

    if (!artifactCtx) {
      logArtifactEvent('artifact.restart.error', {
        error: 'Artifact context not available',
        durationMs: Date.now() - startTime
      })
      return {
        success: false,
        error: 'Artifact context not available'
      }
    }

    logArtifactEvent('artifact.restart.start', {
      chatId: artifactCtx.chatId,
      isGuest: artifactCtx.isGuest,
      reason: params.reason
    })

    const result = {
      success: true,
      action: 'restart' as const,
      reason: params.reason
    }

    logArtifactEvent('artifact.restart.complete', {
      chatId: artifactCtx.chatId,
      isGuest: artifactCtx.isGuest,
      durationMs: Date.now() - startTime
    })

    return result
  }
})
