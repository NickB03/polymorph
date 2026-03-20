import { tool } from 'ai'
import { z } from 'zod'

import { CANVAS_ALLOWED_FILES } from '@/lib/canvas/constants'
import { refreshGuestCanvasToken } from '@/lib/canvas/guest-token'
import {
  loadCanvasArtifactState,
  saveCanvasArtifactVersion,
  updateCanvasArtifactDraftFromSource
} from '@/lib/canvas/service'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import type { CanvasSourceFiles } from '@/lib/types/canvas'

const CANVAS_ALLOWED_FILE_SET = new Set<string>(CANVAS_ALLOWED_FILES)

function normalizeCanvasFileKeys(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input
  }

  const files = input as Record<string, unknown>
  const normalized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(files)) {
    const quote = key[0]
    const isQuotedKey =
      key.length >= 2 &&
      (quote === "'" || quote === '"') &&
      key[key.length - 1] === quote

    if (isQuotedKey) {
      const unquotedKey = key.slice(1, -1)
      if (CANVAS_ALLOWED_FILE_SET.has(unquotedKey)) {
        normalized[unquotedKey] = value
        continue
      }
    }

    normalized[key] = value
  }

  return normalized
}

const CanvasFilesSchema = z.preprocess(
  normalizeCanvasFileKeys,
  z
    .object({
      'App.tsx': z.string(),
      'styles.css': z.string().optional(),
      'components.tsx': z.string().optional(),
      'meta.json': z.string().optional()
    })
    .strict()
)

export const UpdateCanvasArtifactSchema = z.object({
  artifactId: z.string().min(1).describe('ID of the artifact to update'),
  baseRevision: z
    .number()
    .int()
    .min(0)
    .describe(
      'The draft revision number this update is based on. Must match the current revision or the update will fail with a stale-revision conflict.'
    ),
  files: CanvasFilesSchema.describe(
    `Full replacement virtual file set. Keys must be allowed file names (${CANVAS_ALLOWED_FILES.join(', ')}). App.tsx is required; other files are optional.`
  ),
  changeSummary: z
    .string()
    .optional()
    .describe('Brief description of what changed')
})

export type UpdateCanvasArtifactInput = z.infer<
  typeof UpdateCanvasArtifactSchema
>

export type UpdateCanvasArtifactOutput = {
  artifactId: string
  status: string
  draftRevision: number
  currentVersionId: string | null
  error?: string
  errorCode?: string
}

/**
 * Create an update canvas artifact tool bound to a request-scoped context.
 *
 * The tool:
 * 1. Emits `data-canvasArtifactStatus` with `status: 'generating'` immediately
 * 2. Loads the latest persisted `draftSource` and `draftRevision`
 * 3. Calls `updateCanvasArtifactDraftFromSource()` from the service layer
 * 4. If stale revision: returns a conflict result
 * 5. Auto-creates a version (createdBy: 'ai')
 * 6. Emits results
 * 7. If guest: includes rotated `guestCanvasToken` in the status part
 */
export function updateCanvasArtifactTool(ctx: CanvasToolContext) {
  return tool({
    description:
      'Update the existing canvas artifact for this chat. Provide the full replacement source file set and the baseRevision you are updating from. The update will fail if the baseRevision is stale.',
    inputSchema: UpdateCanvasArtifactSchema,
    execute: async ({ artifactId, baseRevision, files }) => {
      const draftSource = files as CanvasSourceFiles

      // Emit generating status immediately
      ctx.emitter.emitCanvasArtifactStatus({
        artifactId,
        chatId: ctx.chatId,
        status: 'generating',
        draftRevision: baseRevision,
        currentVersionId: null,
        updatedAt: new Date().toISOString()
      })

      // Load the latest draft to verify revision
      const currentState = await loadCanvasArtifactState({
        artifactId,
        userId: ctx.userId
      })

      if (!currentState) {
        return {
          artifactId,
          status: 'compile_failed',
          draftRevision: baseRevision,
          currentVersionId: null,
          error: 'Artifact not found',
          errorCode: 'not-found'
        } satisfies UpdateCanvasArtifactOutput
      }

      // Attempt the draft update with optimistic concurrency
      const result = await updateCanvasArtifactDraftFromSource({
        artifactId,
        expectedRevision: baseRevision,
        draftSource,
        userId: ctx.userId
      })

      // Handle stale revision conflict
      if (!result.ok && result.errorCode === 'stale-revision') {
        const latest = await loadCanvasArtifactState({
          artifactId,
          userId: ctx.userId
        })
        if (latest) {
          ctx.emitter.emitCanvasArtifactStatus({
            artifactId,
            chatId: ctx.chatId,
            status: latest.status,
            draftRevision: latest.draftRevision,
            currentVersionId: latest.currentVersionId,
            updatedAt: latest.updatedAt
          })
        }
        return {
          artifactId,
          status: latest?.status ?? currentState.status,
          draftRevision: latest?.draftRevision ?? currentState.draftRevision,
          currentVersionId:
            latest?.currentVersionId ?? currentState.currentVersionId,
          error: result.error,
          errorCode: result.errorCode
        } satisfies UpdateCanvasArtifactOutput
      }

      // Handle other failures
      if (!result.ok || !result.artifact) {
        return {
          artifactId,
          status: 'compile_failed',
          draftRevision: baseRevision,
          currentVersionId: currentState.currentVersionId,
          error: result.error ?? 'Failed to update artifact',
          errorCode: result.errorCode
        } satisfies UpdateCanvasArtifactOutput
      }

      const artifact = result.artifact

      // Auto-create version on successful compile
      if (artifact.status === 'ready') {
        const versionResult = await saveCanvasArtifactVersion({
          artifactId,
          createdBy: 'ai',
          userId: ctx.userId
        })

        // Use the version result if it succeeded (it has the updated currentVersionId)
        if (versionResult.ok && versionResult.artifact) {
          const versioned = versionResult.artifact

          ctx.emitter.emitCanvasArtifact({
            artifactId: versioned.artifactId,
            chatId: versioned.chatId,
            title: versioned.title,
            status: versioned.status,
            draftRevision: versioned.draftRevision,
            currentVersionId: versioned.currentVersionId
          })

          let guestCanvasToken: string | undefined
          if (ctx.isGuest) {
            guestCanvasToken = await refreshGuestCanvasToken({
              chatId: ctx.chatId,
              artifactId
            })
          }

          ctx.emitter.emitCanvasArtifactStatus({
            artifactId: versioned.artifactId,
            chatId: versioned.chatId,
            status: versioned.status,
            draftRevision: versioned.draftRevision,
            currentVersionId: versioned.currentVersionId,
            updatedAt: versioned.updatedAt,
            ...(guestCanvasToken ? { guestCanvasToken } : {})
          })

          return {
            artifactId: versioned.artifactId,
            status: versioned.status,
            draftRevision: versioned.draftRevision,
            currentVersionId: versioned.currentVersionId
          } satisfies UpdateCanvasArtifactOutput
        }
      }

      // Fallback: emit without version if versioning failed or not ready
      ctx.emitter.emitCanvasArtifact({
        artifactId: artifact.artifactId,
        chatId: artifact.chatId,
        title: artifact.title,
        status: artifact.status,
        draftRevision: artifact.draftRevision,
        currentVersionId: artifact.currentVersionId
      })

      let guestCanvasToken: string | undefined
      if (ctx.isGuest) {
        guestCanvasToken = await refreshGuestCanvasToken({
          chatId: ctx.chatId,
          artifactId
        })
      }

      ctx.emitter.emitCanvasArtifactStatus({
        artifactId: artifact.artifactId,
        chatId: artifact.chatId,
        status: artifact.status,
        draftRevision: artifact.draftRevision,
        currentVersionId: artifact.currentVersionId,
        updatedAt: artifact.updatedAt,
        ...(guestCanvasToken ? { guestCanvasToken } : {})
      })

      return {
        artifactId: artifact.artifactId,
        status: artifact.status,
        draftRevision: artifact.draftRevision,
        currentVersionId: artifact.currentVersionId
      } satisfies UpdateCanvasArtifactOutput
    }
  })
}
