import { tool } from 'ai'
import { z } from 'zod'

import { logArtifactEvent } from '@/lib/artifacts/observability'
import { getArtifactContext } from '@/lib/artifacts/tool-context'

const GetArtifactStatusSchema = z.object({
  reason: z.string().optional().describe('Why the status check was requested')
})

export const getArtifactStatusTool = tool({
  description:
    'Check the current status of the webapp artifact (building, ready, failed, etc.). Use when you need to verify the artifact state before making changes or when the user asks about the artifact status.',
  inputSchema: GetArtifactStatusSchema,
  execute: async (params, context) => {
    const artifactCtx = getArtifactContext(context)

    if (!artifactCtx) {
      logArtifactEvent('artifact.status.query', {
        error: 'Artifact context not available'
      })
      return {
        success: false,
        error: 'Artifact context not available'
      }
    }

    logArtifactEvent('artifact.status.query', {
      chatId: artifactCtx.chatId,
      isGuest: artifactCtx.isGuest,
      reason: params.reason
    })

    return {
      success: true,
      action: 'status' as const,
      reason: params.reason
    }
  }
})
