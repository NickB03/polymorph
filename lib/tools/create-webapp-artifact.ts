import { tool } from 'ai'
import { z } from 'zod'

import { orchestrateCreate } from '@/lib/artifacts/orchestrate'
import { getArtifactContext } from '@/lib/artifacts/tool-context'

const MAX_FILES = 50
const MAX_FILE_SIZE = 102_400 // 100 KB per file

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
      'Map of source file paths to contents. Only app source files — do not include package.json, config files, or components/ui files.'
    )
})

export const createWebappArtifactTool = tool({
  description:
    'Create a new React webapp artifact with live preview. Use this when the user asks to build, create, or make a webapp, app, page, dashboard, or interactive UI. Provide complete source files for the artifact. When this tool returns success, the artifact is deployed — do not call again to fix paths or structure.',
  inputSchema: CreateWebappArtifactSchema,
  execute: async (params, context) => {
    const artifactCtx = getArtifactContext(context)

    if (!artifactCtx) {
      return {
        success: false,
        error: 'Artifact context not available'
      }
    }

    try {
      return await orchestrateCreate(params, artifactCtx)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[createWebappArtifact]', message)
      return {
        success: false,
        error: `Artifact creation failed: ${message}`
      }
    }
  }
})
