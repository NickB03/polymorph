import { tool } from 'ai'
import { z } from 'zod'

import { orchestrateCreate } from '@/lib/artifacts/orchestrate'
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
    const artifactCtx = getArtifactContext(context)

    if (!artifactCtx) {
      return {
        success: false,
        error: 'Artifact context not available'
      }
    }

    return orchestrateCreate(params, artifactCtx)
  }
})
