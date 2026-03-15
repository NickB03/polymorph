import { tool } from 'ai'
import { z } from 'zod'

import { queryArtifactStatus } from '@/lib/artifacts/orchestrate'
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
      return {
        success: false,
        error: 'Artifact context not available'
      }
    }

    return queryArtifactStatus(params, artifactCtx)
  }
})
