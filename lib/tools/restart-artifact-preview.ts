import { tool } from 'ai'
import { z } from 'zod'

import { orchestrateRestart } from '@/lib/artifacts/orchestrate'
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

    try {
      return await orchestrateRestart(params, artifactCtx)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[restartArtifactPreview]', message)
      return {
        success: false,
        error: `Artifact preview restart failed: ${message}`
      }
    }
  }
})
