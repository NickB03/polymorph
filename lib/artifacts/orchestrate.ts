import { getTtlMs, signGuestArtifactToken } from '@/lib/artifacts/guest-token'
import { logArtifactEvent } from '@/lib/artifacts/observability'
import { createE2BRuntime } from '@/lib/artifacts/runtime'
import {
  getTemplateId,
  shouldSkipInstall
} from '@/lib/artifacts/runtime/config'
import { isSandboxNotFoundError } from '@/lib/artifacts/runtime/errors'
import { readTemplateFiles } from '@/lib/artifacts/templates/read-template'
import type { ArtifactToolContext } from '@/lib/artifacts/tool-context'
import { validateArtifactSource } from '@/lib/artifacts/validation/validate-artifact-source'
import * as dbActions from '@/lib/db/actions'
import { GUEST_USER_ID } from '@/lib/db/constants'
import type {
  ArtifactRuntimeSessionRecord,
  ArtifactStatus
} from '@/lib/types/artifact'
import { getTextFromParts } from '@/lib/utils/message-utils'

type CreateParams = {
  title: string
  description: string
  files: Record<string, string>
}

type UpdateParams = {
  title?: string
  description: string
  files: Record<string, string>
}

type RestartParams = {
  reason?: string
}

type StatusParams = {
  reason?: string
}

function getGuestExpiryDate(): Date {
  return new Date(Date.now() + getTtlMs())
}

function summarizePrompt(
  ctx: ArtifactToolContext,
  fallbackTitle: string,
  fallbackDescription?: string
): string {
  const lastUserMessage = ctx.messages.findLast(
    message => message.role === 'user'
  )
  const text = getTextFromParts(lastUserMessage?.parts).trim()

  if (text) return text.slice(0, 500)
  if (fallbackDescription?.trim())
    return fallbackDescription.trim().slice(0, 500)
  return fallbackTitle
}

/** Shared payload fields for both artifact card and status emits. */
type EmitPayload = {
  artifactId: string
  title: string
  status: ArtifactStatus
  previewUrl?: string
  revisionId?: string
  guestArtifactToken?: string
}

function buildOptionalFields(input: {
  previewUrl?: string
  revisionId?: string
  guestArtifactToken?: string
}) {
  return {
    ...(input.previewUrl ? { previewUrl: input.previewUrl } : {}),
    ...(input.revisionId ? { revisionId: input.revisionId } : {}),
    ...(input.guestArtifactToken
      ? { guestArtifactToken: input.guestArtifactToken }
      : {})
  }
}

/**
 * Emit both the artifact card and status update in one call.
 * Keeps the two emitters in sync — they always share the same data.
 */
function emitArtifactState(ctx: ArtifactToolContext, input: EmitPayload) {
  const optional = buildOptionalFields(input)
  ctx.emitArtifact({
    id: input.artifactId,
    title: input.title,
    status: input.status,
    ...optional
  })
  ctx.emitArtifactStatus({
    id: input.artifactId,
    status: input.status,
    ...optional
  })
}

/** Emit only a status update (no card) — used for transient states like 'building'. */
function emitStatusOnly(
  ctx: ArtifactToolContext,
  input: { artifactId: string; status: ArtifactStatus }
) {
  ctx.emitArtifactStatus({ id: input.artifactId, status: input.status })
}

/**
 * Normalize a file path key from model output.
 *
 * Some models (notably Gemini) wrap z.record() keys in literal double-quote
 * characters — e.g. `"src/App.tsx"` instead of `src/App.tsx`. Strip those so
 * validation can match the `src/` prefix.
 */
function normalizeFilePath(filePath: string): string {
  let normalized = filePath.trim()

  if (!normalized) {
    throw new Error('File path cannot be empty')
  }

  // Strip JSON array wrapper (literal `["src/App.tsx"]` → `"src/App.tsx"`)
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    try {
      const parsed = JSON.parse(normalized)
      if (Array.isArray(parsed) && parsed.length > 0) {
        normalized = String(parsed[0]).trim()
      }
    } catch {
      // Not valid JSON, strip brackets manually
      normalized = normalized.slice(1, -1).trim()
    }
  }

  // Strip surrounding double quotes (literal `"src/App.tsx"` → `src/App.tsx`)
  if (
    normalized.length >= 2 &&
    normalized.startsWith('"') &&
    normalized.endsWith('"')
  ) {
    normalized = normalized.slice(1, -1)
  }

  // Strip surrounding single quotes (just in case)
  if (
    normalized.length >= 2 &&
    normalized.startsWith("'") &&
    normalized.endsWith("'")
  ) {
    normalized = normalized.slice(1, -1)
  }

  // Ensure files without src/ prefix get it added (common model mistake)
  if (
    !normalized.startsWith('src/') &&
    (normalized.endsWith('.tsx') ||
      normalized.endsWith('.ts') ||
      normalized.endsWith('.css'))
  ) {
    normalized = `src/${normalized}`
  }

  return normalized
}

function validateSourceFiles(files: Record<string, string>) {
  const validatedFiles: Record<string, string> = {}
  const errors: Array<{
    code: string
    message: string
    line?: number
    importPath?: string
  }> = []
  const repairs: string[] = []

  for (const [rawFilePath, content] of Object.entries(files)) {
    let filePath: string
    try {
      filePath = normalizeFilePath(rawFilePath)
    } catch {
      errors.push({
        code: 'EMPTY_FILE_PATH',
        message: `File path is empty or whitespace-only: "${rawFilePath}"`
      })
      continue
    }

    if (filePath !== rawFilePath) {
      repairs.push(`Fixed path: ${rawFilePath} → ${filePath}`)
    }

    const validation = validateArtifactSource({ filePath, content })
    if (!validation.valid) {
      errors.push(...validation.errors)
      continue
    }

    if (validation.repaired) {
      repairs.push(`Auto-fixed imports in ${filePath}`)
    }

    validatedFiles[filePath] = validation.repairedContent ?? content
  }

  return {
    valid: errors.length === 0,
    errors,
    files: validatedFiles,
    repairs
  }
}

async function issueGuestToken(input: {
  ctx: ArtifactToolContext
  artifactId: string
  runtimeSession: ArtifactRuntimeSessionRecord
}): Promise<string | undefined> {
  if (!input.ctx.isGuest) return undefined

  return signGuestArtifactToken({
    artifactId: input.artifactId,
    runtimeSessionId: input.runtimeSession.id,
    sandboxId: input.runtimeSession.sandboxId,
    chatId: input.ctx.chatId,
    expiresAt: (
      input.runtimeSession.expiresAt ?? getGuestExpiryDate()
    ).getTime()
  })
}

async function resolveExistingArtifact(ctx: ArtifactToolContext) {
  if (ctx.isGuest) {
    const handle = await ctx.resolveGuestArtifactToken()
    if (!handle || handle.chatId !== ctx.chatId) {
      return null
    }

    const artifact = await dbActions.loadArtifactByChatId(ctx.chatId, null)
    if (!artifact || artifact.id !== handle.artifactId) {
      return null
    }

    const runtimeSession = await dbActions.loadArtifactRuntimeSession(
      artifact.id,
      null
    )

    if (
      !runtimeSession ||
      runtimeSession.id !== handle.runtimeSessionId ||
      runtimeSession.sandboxId !== handle.sandboxId
    ) {
      return null
    }

    return { artifact, runtimeSession, guestHandle: handle }
  }

  const artifact = await dbActions.loadArtifactByChatId(ctx.chatId, ctx.userId)
  if (!artifact) return null

  const runtimeSession = await dbActions.loadArtifactRuntimeSession(
    artifact.id,
    ctx.userId
  )

  return {
    artifact,
    runtimeSession,
    guestHandle: null
  }
}

export async function orchestrateCreate(
  params: CreateParams,
  ctx: ArtifactToolContext
) {
  // Guard: check for an existing artifact to prevent duplicates and orphaned
  // sandboxes when a create races with a rebuild or another create.
  const effectiveUserId = ctx.isGuest ? GUEST_USER_ID : ctx.userId
  const existingArtifact = await dbActions.loadArtifactByChatId(
    ctx.chatId,
    ctx.isGuest ? null : ctx.userId
  )
  if (existingArtifact) {
    const inProgress: Array<ArtifactStatus> = ['building', 'restarting']
    if (inProgress.includes(existingArtifact.status)) {
      return {
        success: false as const,
        action: 'create' as const,
        error: `An artifact is already ${existingArtifact.status} for this chat. Wait for it to finish or check its status.`
      }
    }
    // For 'ready' artifacts, the model should use updateWebappArtifact instead.
    if (existingArtifact.status === 'ready') {
      return {
        success: false as const,
        action: 'create' as const,
        error:
          'An artifact already exists for this chat. Use updateWebappArtifact to modify it.'
      }
    }
    // 'expired' and 'failed' statuses are OK — allow re-creation.
  }

  const validation = validateSourceFiles(params.files)
  if (!validation.valid) {
    return {
      success: false as const,
      action: 'create' as const,
      errors: validation.errors
    }
  }

  const promptSummary = summarizePrompt(ctx, params.title, params.description)
  const runtime = createE2BRuntime()

  // For guest users, ensure a chat record exists so the artifact foreign key
  // is satisfied. Ephemeral chats don't persist a DB row by default.
  if (ctx.isGuest) {
    await dbActions.ensureChatRecord({
      id: ctx.chatId,
      title: params.title,
      visibility: 'private'
    })
  }

  let artifact = await dbActions.createArtifactRecord({
    chatId: ctx.chatId,
    userId: effectiveUserId,
    title: params.title,
    framework: 'react-spa',
    status: 'building'
  })

  // Only emit status (drives workspace panel) — not a card.
  // The inline card is emitted once at the final state (ready/failed)
  // to avoid duplicate cards in chat.
  emitStatusOnly(ctx, { artifactId: artifact.id, status: 'building' })

  let runtimeSession: ArtifactRuntimeSessionRecord | null = null
  let sandboxId: string | null = null

  try {
    ctx.emitArtifactLog({
      artifactId: artifact.id,
      message: 'Creating sandbox...',
      level: 'info'
    })

    const createdSession = await runtime.createSession({
      templateId: getTemplateId()
    })
    sandboxId = createdSession.sandboxId

    runtimeSession = await dbActions.upsertArtifactRuntimeSession(
      {
        artifactId: artifact.id,
        provider: 'e2b',
        sandboxId: createdSession.sandboxId,
        status: 'building',
        startedAt: new Date(),
        ...(ctx.isGuest ? { expiresAt: getGuestExpiryDate() } : {})
      },
      effectiveUserId
    )

    const skipInstall = shouldSkipInstall()

    ctx.emitArtifactLog({
      artifactId: artifact.id,
      message: skipInstall
        ? 'Writing source files...'
        : 'Writing template and source files...',
      level: 'info'
    })

    // When using a custom template, template files (configs, UI components,
    // node_modules) are already baked into the image — only write model-
    // generated source files. For the base template, merge everything.
    const files = skipInstall
      ? validation.files
      : { ...(await readTemplateFiles()), ...validation.files }
    await runtime.writeFiles({
      sandboxId: createdSession.sandboxId,
      files
    })

    if (!skipInstall) {
      ctx.emitArtifactLog({
        artifactId: artifact.id,
        message: 'Installing dependencies...',
        level: 'info'
      })
      try {
        await runtime.installDependencies({
          sandboxId: createdSession.sandboxId
        })
      } catch (installError) {
        const installMessage =
          installError instanceof Error
            ? installError.message
            : 'npm install failed'
        ctx.emitArtifactLog({
          artifactId: artifact.id,
          message: installMessage,
          level: 'error'
        })
        throw installError
      }
    }

    ctx.emitArtifactLog({
      artifactId: artifact.id,
      message: 'Starting preview...',
      level: 'info'
    })

    const preview = await runtime.startPreview({
      sandboxId: createdSession.sandboxId
    })

    // Quick compilation check — catch broken imports/syntax before
    // reporting success. Without this, Vite serves an error overlay
    // but the tool returns { success: true } and the model can't
    // self-correct.
    ctx.emitArtifactLog({
      artifactId: artifact.id,
      message: 'Verifying build...',
      level: 'info'
    })

    const buildCheck = await runtime.runCommand({
      sandboxId: createdSession.sandboxId,
      command: 'set -o pipefail; npx vite build 2>&1 | tail -30',
      timeoutMs: 30_000
    })

    if (buildCheck.exitCode !== 0) {
      const buildError =
        buildCheck.stderr ||
        buildCheck.stdout ||
        'Build failed with unknown error'

      ctx.emitArtifactLog({
        artifactId: artifact.id,
        message: `Build verification failed: ${buildError}`,
        level: 'error'
      })

      // Clean up the session as failed
      runtimeSession = await dbActions.upsertArtifactRuntimeSession(
        {
          id: runtimeSession!.id,
          artifactId: artifact.id,
          provider: 'e2b',
          sandboxId: createdSession.sandboxId,
          previewUrl: preview.previewUrl,
          status: 'failed',
          startedAt: runtimeSession!.startedAt,
          expiresAt: runtimeSession!.expiresAt,
          lastHeartbeatAt: new Date()
        },
        effectiveUserId
      )

      emitArtifactState(ctx, {
        artifactId: artifact.id,
        title: params.title,
        status: 'failed'
      })

      // Return structured error so the model's ToolLoopAgent can self-correct
      return {
        success: false as const,
        action: 'create' as const,
        error: `Artifact build failed. Fix these errors and try again:\n${buildError}`,
        errors: [
          {
            code: 'BUILD_FAILED' as const,
            message: buildError
          }
        ]
      }
    }

    runtimeSession = await dbActions.upsertArtifactRuntimeSession(
      {
        id: runtimeSession.id,
        artifactId: artifact.id,
        provider: 'e2b',
        sandboxId: createdSession.sandboxId,
        previewUrl: preview.previewUrl,
        status: 'ready',
        startedAt: runtimeSession.startedAt,
        expiresAt: runtimeSession.expiresAt,
        lastHeartbeatAt: new Date()
      },
      effectiveUserId
    )

    const revision =
      effectiveUserId && ctx.triggeringMessageId
        ? await dbActions.appendArtifactRevision(
            {
              artifactId: artifact.id,
              triggeringMessageId: ctx.triggeringMessageId,
              promptSummary,
              title: params.title,
              sourceFiles: validation.files
            },
            ctx.userId
          )
        : null

    const guestArtifactToken = await issueGuestToken({
      ctx,
      artifactId: artifact.id,
      runtimeSession
    })

    emitArtifactState(ctx, {
      artifactId: artifact.id,
      title: params.title,
      status: 'ready',
      previewUrl: preview.previewUrl,
      ...(revision ? { revisionId: revision.id } : {}),
      ...(guestArtifactToken ? { guestArtifactToken } : {})
    })

    logArtifactEvent('artifact.create.complete', {
      artifactId: artifact.id,
      chatId: ctx.chatId,
      isGuest: ctx.isGuest
    })

    return {
      success: true as const,
      action: 'create' as const,
      title: params.title,
      description: params.description,
      acceptedFiles: Object.keys(validation.files),
      artifactId: artifact.id,
      previewUrl: preview.previewUrl,
      status:
        'Artifact is live and ready. No further file changes needed unless the user requests modifications.',
      ...(validation.repairs.length > 0
        ? {
            autoRepairs: validation.repairs,
            note: 'These fixes were applied automatically. Do not re-submit corrected files.'
          }
        : {}),
      ...(revision ? { revisionId: revision.id } : {}),
      ...(guestArtifactToken ? { guestArtifactToken } : {})
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Artifact creation failed'

    if (runtimeSession) {
      runtimeSession = await dbActions.upsertArtifactRuntimeSession(
        {
          id: runtimeSession.id,
          artifactId: artifact.id,
          provider: 'e2b',
          sandboxId: runtimeSession.sandboxId,
          previewUrl: runtimeSession.previewUrl,
          status: 'failed',
          startedAt: runtimeSession.startedAt,
          expiresAt: runtimeSession.expiresAt,
          lastHeartbeatAt: new Date()
        },
        effectiveUserId
      )
    } else {
      artifact =
        (await dbActions.updateArtifactRecord(
          {
            id: artifact.id,
            status: 'failed'
          },
          effectiveUserId
        )) ?? artifact
    }

    const guestArtifactToken =
      runtimeSession &&
      (await issueGuestToken({
        ctx,
        artifactId: artifact.id,
        runtimeSession
      }))

    ctx.emitArtifactLog({
      artifactId: artifact.id,
      message,
      level: 'error'
    })
    emitArtifactState(ctx, {
      artifactId: artifact.id,
      title: params.title,
      status: 'failed',
      ...(guestArtifactToken ? { guestArtifactToken } : {})
    })

    if (sandboxId) {
      runtime.destroySession({ sandboxId }).catch(() => {})
    }

    logArtifactEvent('artifact.create.error', {
      artifactId: artifact.id,
      chatId: ctx.chatId,
      isGuest: ctx.isGuest,
      error: message
    })

    return {
      success: false as const,
      action: 'create' as const,
      error: message
    }
  }
}

/**
 * Shared sandbox recovery: rebuild from the latest revision when the
 * sandbox has expired. Used by both `orchestrateUpdate` and
 * `orchestrateRestart` to avoid duplicating the rebuild flow.
 *
 * Returns the rebuild result and fresh runtime session on success.
 * On failure, logs the error and cleans up the sandbox, then re-throws.
 */
async function recoverExpiredSandbox(input: {
  existing: Awaited<ReturnType<typeof resolveExistingArtifact>> & object
  ctx: ArtifactToolContext
  action: string
}): Promise<{
  rebuildResult: { sandboxId: string; previewUrl: string }
  newRuntimeSession: ArtifactRuntimeSessionRecord | null
  guestArtifactToken: string | undefined
}> {
  const { existing, ctx, action } = input
  let recoveredSandboxId: string | null = null

  try {
    logArtifactEvent(`artifact.${action}.sandbox-recovery`, {
      artifactId: existing.artifact.id,
      chatId: ctx.chatId,
      isGuest: ctx.isGuest
    })

    emitStatusOnly(ctx, {
      artifactId: existing.artifact.id,
      status: 'building'
    })

    ctx.emitArtifactLog({
      artifactId: existing.artifact.id,
      message: 'Sandbox expired — rebuilding from last revision...',
      level: 'info'
    })

    const { rebuildArtifactFromRevision } =
      await import('@/lib/artifacts/rebuild')
    const rebuildResult = await rebuildArtifactFromRevision({
      artifactId: existing.artifact.id,
      userId: ctx.isGuest ? null : ctx.userId
    })

    if (!rebuildResult.success) {
      throw new Error(rebuildResult.error || 'Rebuild failed')
    }
    recoveredSandboxId = rebuildResult.sandboxId

    const newRuntimeSession = await dbActions.loadArtifactRuntimeSession(
      existing.artifact.id,
      ctx.isGuest ? null : ctx.userId
    )

    const guestArtifactToken = newRuntimeSession
      ? await issueGuestToken({
          ctx,
          artifactId: existing.artifact.id,
          runtimeSession: newRuntimeSession
        })
      : undefined

    return { rebuildResult, newRuntimeSession, guestArtifactToken }
  } catch (recoveryError) {
    const recoveryMessage =
      recoveryError instanceof Error ? recoveryError.message : 'Recovery failed'

    logArtifactEvent(`artifact.${action}.sandbox-recovery.failed`, {
      artifactId: existing.artifact.id,
      chatId: ctx.chatId,
      error: recoveryMessage
    })

    if (recoveredSandboxId) {
      createE2BRuntime()
        .destroySession({ sandboxId: recoveredSandboxId })
        .catch(() => {})
    }

    throw recoveryError
  }
}

export async function orchestrateUpdate(
  params: UpdateParams,
  ctx: ArtifactToolContext
) {
  const existing = await resolveExistingArtifact(ctx)
  if (!existing || !existing.runtimeSession) {
    return {
      success: false as const,
      action: 'update' as const,
      error: 'No artifact exists yet. Create one first.'
    }
  }

  const validation = validateSourceFiles(params.files)
  if (!validation.valid) {
    return {
      success: false as const,
      action: 'update' as const,
      errors: validation.errors
    }
  }

  const title = params.title ?? existing.artifact.title
  const promptSummary = summarizePrompt(ctx, title, params.description)
  const runtime = createE2BRuntime()

  emitStatusOnly(ctx, { artifactId: existing.artifact.id, status: 'building' })

  try {
    ctx.emitArtifactLog({
      artifactId: existing.artifact.id,
      message: 'Applying source update...',
      level: 'info'
    })

    await runtime.applySourceUpdate({
      sandboxId: existing.runtimeSession.sandboxId,
      files: validation.files
    })

    const runtimeSession = await dbActions.upsertArtifactRuntimeSession(
      {
        id: existing.runtimeSession.id,
        artifactId: existing.artifact.id,
        provider: 'e2b',
        sandboxId: existing.runtimeSession.sandboxId,
        previewUrl: existing.runtimeSession.previewUrl,
        status: 'ready',
        startedAt: existing.runtimeSession.startedAt,
        expiresAt: existing.runtimeSession.expiresAt,
        lastHeartbeatAt: new Date()
      },
      ctx.userId
    )

    // Load previous revision's source files so we can merge the delta.
    // NOTE: This merge is additive-only -- it cannot represent file deletions.
    // If the model removes a file by no longer importing it, the file content
    // persists in the stored revision. This is harmless: Vite tree-shakes
    // unreferenced modules, so orphaned files don't affect the running app.
    // The live sandbox has the same behavior (applySourceUpdate never deletes).
    const previousRevision = await dbActions.loadLatestRevisionWithSource(
      existing.artifact.id,
      ctx.userId
    )

    // Merge: previous full source + current update delta = new full source
    const mergedSourceFiles = {
      ...(previousRevision?.sourceFiles ?? {}),
      ...validation.files
    }

    const revision =
      ctx.userId && ctx.triggeringMessageId
        ? await dbActions.appendArtifactRevision(
            {
              artifactId: existing.artifact.id,
              triggeringMessageId: ctx.triggeringMessageId,
              promptSummary,
              title,
              sourceFiles: mergedSourceFiles
            },
            ctx.userId
          )
        : null

    const guestArtifactToken = await issueGuestToken({
      ctx,
      artifactId: existing.artifact.id,
      runtimeSession
    })

    emitArtifactState(ctx, {
      artifactId: existing.artifact.id,
      title,
      status: 'ready',
      ...(runtimeSession.previewUrl
        ? { previewUrl: runtimeSession.previewUrl }
        : {}),
      ...(revision ? { revisionId: revision.id } : {}),
      ...(guestArtifactToken ? { guestArtifactToken } : {})
    })

    return {
      success: true as const,
      action: 'update' as const,
      title: params.title,
      description: params.description,
      acceptedFiles: Object.keys(validation.files),
      artifactId: existing.artifact.id,
      previewUrl: runtimeSession.previewUrl ?? undefined,
      status:
        'Artifact is live and ready. No further file changes needed unless the user requests modifications.',
      ...(validation.repairs.length > 0
        ? {
            autoRepairs: validation.repairs,
            note: 'These fixes were applied automatically. Do not re-submit corrected files.'
          }
        : {}),
      ...(revision ? { revisionId: revision.id } : {}),
      ...(guestArtifactToken ? { guestArtifactToken } : {})
    }
  } catch (error) {
    // Transparent recovery: if the sandbox expired, rebuild from the latest
    // revision then apply the pending update on top.
    if (isSandboxNotFoundError(error)) {
      try {
        const recovery = await recoverExpiredSandbox({
          existing,
          ctx,
          action: 'update'
        })

        // Apply the pending update to the freshly rebuilt sandbox
        ctx.emitArtifactLog({
          artifactId: existing.artifact.id,
          message: 'Applying source update to rebuilt sandbox...',
          level: 'info'
        })

        const newRuntime = createE2BRuntime()
        await newRuntime.applySourceUpdate({
          sandboxId: recovery.rebuildResult.sandboxId,
          files: validation.files
        })

        // Build verification — catch broken imports/syntax in the recovered sandbox
        const buildCheck = await newRuntime.runCommand({
          sandboxId: recovery.rebuildResult.sandboxId,
          command: 'set -o pipefail; npx vite build 2>&1 | tail -30',
          timeoutMs: 30_000
        })

        if (buildCheck.exitCode !== 0) {
          const buildError =
            buildCheck.stderr ||
            buildCheck.stdout ||
            'Build failed with unknown error'
          throw new Error(
            `Recovered sandbox build verification failed: ${buildError}`
          )
        }

        if (recovery.newRuntimeSession) {
          await dbActions.upsertArtifactRuntimeSession(
            {
              id: recovery.newRuntimeSession.id,
              artifactId: existing.artifact.id,
              provider: 'e2b',
              sandboxId: recovery.rebuildResult.sandboxId,
              previewUrl: recovery.rebuildResult.previewUrl,
              status: 'ready',
              startedAt: recovery.newRuntimeSession.startedAt,
              expiresAt: recovery.newRuntimeSession.expiresAt,
              lastHeartbeatAt: new Date()
            },
            ctx.userId
          )
        }

        // Store the merged revision (same logic as the happy path)
        const previousRevision = await dbActions.loadLatestRevisionWithSource(
          existing.artifact.id,
          ctx.userId
        )
        const mergedSourceFiles = {
          ...(previousRevision?.sourceFiles ?? {}),
          ...validation.files
        }

        const revision =
          ctx.userId && ctx.triggeringMessageId
            ? await dbActions.appendArtifactRevision(
                {
                  artifactId: existing.artifact.id,
                  triggeringMessageId: ctx.triggeringMessageId,
                  promptSummary,
                  title,
                  sourceFiles: mergedSourceFiles
                },
                ctx.userId
              )
            : null

        emitArtifactState(ctx, {
          artifactId: existing.artifact.id,
          title,
          status: 'ready',
          previewUrl: recovery.rebuildResult.previewUrl,
          ...(revision ? { revisionId: revision.id } : {}),
          ...(recovery.guestArtifactToken
            ? { guestArtifactToken: recovery.guestArtifactToken }
            : {})
        })

        return {
          success: true as const,
          action: 'update' as const,
          title: params.title,
          description: params.description,
          acceptedFiles: Object.keys(validation.files),
          artifactId: existing.artifact.id,
          previewUrl: recovery.rebuildResult.previewUrl,
          status:
            'Artifact is live and ready. No further file changes needed unless the user requests modifications.',
          ...(validation.repairs.length > 0
            ? {
                autoRepairs: validation.repairs,
                note: 'These fixes were applied automatically. Do not re-submit corrected files.'
              }
            : {}),
          ...(revision ? { revisionId: revision.id } : {}),
          ...(recovery.guestArtifactToken
            ? { guestArtifactToken: recovery.guestArtifactToken }
            : {})
        }
      } catch {
        // recoverExpiredSandbox already logged and cleaned up
      }
    }

    const message =
      error instanceof Error ? error.message : 'Artifact update failed'

    await dbActions.upsertArtifactRuntimeSession(
      {
        id: existing.runtimeSession.id,
        artifactId: existing.artifact.id,
        provider: 'e2b',
        sandboxId: existing.runtimeSession.sandboxId,
        previewUrl: existing.runtimeSession.previewUrl,
        status: 'failed',
        startedAt: existing.runtimeSession.startedAt,
        expiresAt: existing.runtimeSession.expiresAt,
        lastHeartbeatAt: new Date()
      },
      ctx.userId
    )

    ctx.emitArtifactLog({
      artifactId: existing.artifact.id,
      message,
      level: 'error'
    })
    emitStatusOnly(ctx, {
      artifactId: existing.artifact.id,
      status: 'failed'
    })

    return {
      success: false as const,
      action: 'update' as const,
      error: message
    }
  }
}

export async function orchestrateRestart(
  params: RestartParams,
  ctx: ArtifactToolContext
) {
  const existing = await resolveExistingArtifact(ctx)
  if (!existing || !existing.runtimeSession) {
    return {
      success: false as const,
      action: 'restart' as const,
      error: 'No active artifact preview exists.'
    }
  }

  const runtime = createE2BRuntime()

  emitStatusOnly(ctx, {
    artifactId: existing.artifact.id,
    status: 'restarting'
  })

  try {
    const preview = await runtime.restartPreview({
      sandboxId: existing.runtimeSession.sandboxId
    })

    const runtimeSession = await dbActions.upsertArtifactRuntimeSession(
      {
        id: existing.runtimeSession.id,
        artifactId: existing.artifact.id,
        provider: 'e2b',
        sandboxId: existing.runtimeSession.sandboxId,
        previewUrl: preview.previewUrl,
        status: 'ready',
        startedAt: existing.runtimeSession.startedAt,
        expiresAt: existing.runtimeSession.expiresAt,
        lastHeartbeatAt: new Date()
      },
      ctx.userId
    )

    const guestArtifactToken = await issueGuestToken({
      ctx,
      artifactId: existing.artifact.id,
      runtimeSession
    })

    emitArtifactState(ctx, {
      artifactId: existing.artifact.id,
      title: existing.artifact.title,
      status: 'ready',
      previewUrl: preview.previewUrl,
      ...(existing.artifact.currentRevisionId
        ? { revisionId: existing.artifact.currentRevisionId }
        : {}),
      ...(guestArtifactToken ? { guestArtifactToken } : {})
    })

    return {
      success: true as const,
      action: 'restart' as const,
      artifactId: existing.artifact.id,
      previewUrl: preview.previewUrl,
      ...(guestArtifactToken ? { guestArtifactToken } : {})
    }
  } catch (error) {
    // Transparent recovery: if the sandbox expired, rebuild from the latest
    // revision then report ready.
    if (isSandboxNotFoundError(error)) {
      try {
        const recovery = await recoverExpiredSandbox({
          existing,
          ctx,
          action: 'restart'
        })

        emitArtifactState(ctx, {
          artifactId: existing.artifact.id,
          title: existing.artifact.title,
          status: 'ready',
          previewUrl: recovery.rebuildResult.previewUrl,
          ...(existing.artifact.currentRevisionId
            ? { revisionId: existing.artifact.currentRevisionId }
            : {}),
          ...(recovery.guestArtifactToken
            ? { guestArtifactToken: recovery.guestArtifactToken }
            : {})
        })

        return {
          success: true as const,
          action: 'restart' as const,
          artifactId: existing.artifact.id,
          previewUrl: recovery.rebuildResult.previewUrl,
          ...(recovery.guestArtifactToken
            ? { guestArtifactToken: recovery.guestArtifactToken }
            : {})
        }
      } catch {
        // recoverExpiredSandbox already logged and cleaned up
      }
    }

    const message =
      error instanceof Error ? error.message : 'Artifact restart failed'

    await dbActions.upsertArtifactRuntimeSession(
      {
        id: existing.runtimeSession.id,
        artifactId: existing.artifact.id,
        provider: 'e2b',
        sandboxId: existing.runtimeSession.sandboxId,
        previewUrl: existing.runtimeSession.previewUrl,
        status: 'failed',
        startedAt: existing.runtimeSession.startedAt,
        expiresAt: existing.runtimeSession.expiresAt,
        lastHeartbeatAt: new Date()
      },
      ctx.userId
    )

    ctx.emitArtifactLog({
      artifactId: existing.artifact.id,
      message,
      level: 'error'
    })
    emitStatusOnly(ctx, {
      artifactId: existing.artifact.id,
      status: 'failed'
    })

    return {
      success: false as const,
      action: 'restart' as const,
      error: message
    }
  }
}

export async function queryArtifactStatus(
  params: StatusParams,
  ctx: ArtifactToolContext
) {
  const existing = await resolveExistingArtifact(ctx)
  if (!existing) {
    return {
      success: true as const,
      action: 'status' as const,
      hasArtifact: false
    }
  }

  const guestArtifactToken =
    existing.runtimeSession &&
    (await issueGuestToken({
      ctx,
      artifactId: existing.artifact.id,
      runtimeSession: existing.runtimeSession
    }))

  emitArtifactState(ctx, {
    artifactId: existing.artifact.id,
    title: existing.artifact.title,
    status: existing.runtimeSession?.status ?? existing.artifact.status,
    ...(existing.runtimeSession?.previewUrl
      ? { previewUrl: existing.runtimeSession.previewUrl }
      : {}),
    ...(existing.artifact.currentRevisionId
      ? { revisionId: existing.artifact.currentRevisionId }
      : {}),
    ...(guestArtifactToken ? { guestArtifactToken } : {})
  })

  return {
    success: true as const,
    action: 'status' as const,
    hasArtifact: true,
    artifactId: existing.artifact.id,
    title: existing.artifact.title,
    status: existing.runtimeSession?.status ?? existing.artifact.status,
    previewUrl: existing.runtimeSession?.previewUrl ?? undefined,
    ...(existing.artifact.currentRevisionId
      ? { revisionId: existing.artifact.currentRevisionId }
      : {}),
    ...(guestArtifactToken ? { guestArtifactToken } : {}),
    ...(params.reason ? { reason: params.reason } : {})
  }
}
