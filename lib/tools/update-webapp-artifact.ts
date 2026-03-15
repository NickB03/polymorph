import { tool } from 'ai'
import { z } from 'zod'

import { orchestrateUpdate } from '@/lib/artifacts/orchestrate'
import { getArtifactContext } from '@/lib/artifacts/tool-context'

const MAX_FILES = 50
const MAX_FILE_SIZE = 102_400 // 100 KB per file

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
    .refine(f => Object.keys(f).length <= MAX_FILES, {
      message: `Artifact cannot contain more than ${MAX_FILES} files`
    })
    .refine(
      f => Object.values(f).every(content => content.length <= MAX_FILE_SIZE),
      {
        message: `Each file must be under ${MAX_FILE_SIZE} characters (100 KB)`
      }
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

    try {
      return await orchestrateUpdate(params, artifactCtx)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[updateWebappArtifact]', message)
      return {
        success: false,
        error: `Artifact update failed: ${message}`
      }
    }
  }
})
