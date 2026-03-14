import { tool } from 'ai'
import { z } from 'zod'

import { logArtifactEvent } from '@/lib/artifacts/observability'
import { getArtifactContext } from '@/lib/artifacts/tool-context'

const UpdateWebappArtifactSchema = z.object({
  title: z
    .string()
    .optional()
    .describe('Updated title for the artifact, if changed'),
  description: z
    .string()
    .describe('Brief description of the changes being made'),
  files: z
    .record(
      z.string().describe('Relative file path (e.g. "src/App.tsx")'),
      z.string().describe('Updated file content')
    )
    .describe(
      'Map of source file paths to updated contents. Only include files that changed. Do not include package.json, config files, or components/ui files.'
    )
})

export const updateWebappArtifactTool = tool({
  description:
    'Update the existing webapp artifact with new or modified source files. Use this when the user asks to change, edit, update, or improve the current artifact. Only include files that need to change.',
  inputSchema: UpdateWebappArtifactSchema,
  execute: async (params, context) => {
    const startTime = Date.now()
    const artifactCtx = getArtifactContext(context)

    if (!artifactCtx) {
      logArtifactEvent('artifact.update.error', {
        error: 'Artifact context not available',
        durationMs: Date.now() - startTime
      })
      return {
        success: false,
        error: 'Artifact context not available'
      }
    }

    logArtifactEvent('artifact.update.start', {
      chatId: artifactCtx.chatId,
      isGuest: artifactCtx.isGuest,
      fileCount: Object.keys(params.files).length
    })

    artifactCtx.emitArtifactEvent({
      artifactId: 'current',
      event: 'update-started',
      payload: { description: params.description }
    })

    const result = {
      success: true,
      title: params.title,
      description: params.description,
      files: params.files,
      action: 'update' as const
    }

    logArtifactEvent('artifact.update.complete', {
      chatId: artifactCtx.chatId,
      isGuest: artifactCtx.isGuest,
      fileCount: Object.keys(params.files).length,
      durationMs: Date.now() - startTime
    })

    return result
  }
})
