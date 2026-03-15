import { tool } from 'ai'
import { z } from 'zod'

import { orchestrateUpdate } from '@/lib/artifacts/orchestrate'
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
    const artifactCtx = getArtifactContext(context)

    if (!artifactCtx) {
      return {
        success: false,
        error: 'Artifact context not available'
      }
    }

    return orchestrateUpdate(params, artifactCtx)
  }
})
