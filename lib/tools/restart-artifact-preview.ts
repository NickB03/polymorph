import { tool } from 'ai'
import { z } from 'zod'

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
    const artifactCtx = getArtifactContext(context)

    if (!artifactCtx) {
      return {
        success: false,
        error: 'Artifact context not available'
      }
    }

    return {
      success: true,
      action: 'restart' as const,
      reason: params.reason
    }
  }
})
