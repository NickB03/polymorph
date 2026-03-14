import { tool } from 'ai'
import { z } from 'zod'

import { logArtifactEvent } from '@/lib/artifacts/observability'
import { getArtifactContext } from '@/lib/artifacts/tool-context'

const CreateWebappArtifactSchema = z.object({
  title: z
    .string()
    .min(1)
    .describe('Short descriptive title for the artifact (e.g. "Pricing Page")'),
  description: z.string().describe('Brief description of what the webapp does'),
  files: z
    .record(
      z.string().describe('Relative file path (e.g. "src/App.tsx")'),
      z.string().describe('File content')
    )
    .describe(
      'Map of source file paths to contents. Only app source files — do not include package.json, config files, or components/ui files.'
    )
})

export const createWebappArtifactTool = tool({
  description:
    'Create a new React webapp artifact with live preview. Use this when the user asks to build, create, or make a webapp, app, page, dashboard, or interactive UI. Provide complete source files for the artifact.',
  inputSchema: CreateWebappArtifactSchema,
  execute: async (params, context) => {
    const startTime = Date.now()
    const artifactCtx = getArtifactContext(context)

    if (!artifactCtx) {
      logArtifactEvent('artifact.create.error', {
        error: 'Artifact context not available',
        durationMs: Date.now() - startTime
      })
      return {
        success: false,
        error: 'Artifact context not available'
      }
    }

    logArtifactEvent('artifact.create.start', {
      chatId: artifactCtx.chatId,
      isGuest: artifactCtx.isGuest,
      title: params.title,
      fileCount: Object.keys(params.files).length
    })

    // Emit building event
    artifactCtx.emitArtifactEvent({
      artifactId: 'pending',
      event: 'create-started',
      payload: { title: params.title }
    })

    // For now, return the structured output that the streaming layer will use
    // to drive the actual runtime operations. The full pipeline (runtime
    // session creation, file writing, build, preview) is orchestrated by
    // the streaming layer using this tool's output.
    const result = {
      success: true,
      title: params.title,
      description: params.description,
      files: params.files,
      action: 'create' as const
    }

    logArtifactEvent('artifact.create.complete', {
      chatId: artifactCtx.chatId,
      isGuest: artifactCtx.isGuest,
      title: params.title,
      fileCount: Object.keys(params.files).length,
      durationMs: Date.now() - startTime
    })

    return result
  }
})
