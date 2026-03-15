import { signGuestArtifactToken } from '@/lib/artifacts/guest-token'
import { logArtifactEvent } from '@/lib/artifacts/observability'
import { createE2BRuntime } from '@/lib/artifacts/runtime'
import { readTemplateFiles } from '@/lib/artifacts/templates/read-template'
import type { ArtifactToolContext } from '@/lib/artifacts/tool-context'
import { validateArtifactSource } from '@/lib/artifacts/validation/validate-artifact-source'
import * as dbActions from '@/lib/db/actions'
import type {
  ArtifactData,
  ArtifactRuntimeSessionRecord,
  ArtifactStatus,
  ArtifactStatusData
} from '@/lib/types/artifact'
import { getTextFromParts } from '@/lib/utils/message-utils'

const DEFAULT_GUEST_TOKEN_TTL_MS = 30 * 60 * 1000

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

function getGuestTokenTtlMs(): number {
  const raw = process.env.GUEST_ARTIFACT_TOKEN_TTL_MS
  if (!raw) return DEFAULT_GUEST_TOKEN_TTL_MS

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_GUEST_TOKEN_TTL_MS
  }

  return parsed
}

function getGuestExpiryDate(): Date {
  return new Date(Date.now() + getGuestTokenTtlMs())
}

function shouldSkipInstall(): boolean {
  return process.env.E2B_SKIP_INSTALL === 'true'
}

function getTemplateId(): string {
  return process.env.E2B_TEMPLATE_ID || 'base'
}

function summarizePrompt(
  ctx: ArtifactToolContext,
  fallbackTitle: string,
  fallbackDescription?: string
): string {
  const lastUserMessage = [...ctx.messages]
    .reverse()
    .find(message => message.role === 'user')
  const text = getTextFromParts(lastUserMessage?.parts).trim()

  if (text) return text.slice(0, 500)
  if (fallbackDescription?.trim())
    return fallbackDescription.trim().slice(0, 500)
  return fallbackTitle
}

function buildStatusPayload(input: {
  artifactId: string
  status: ArtifactStatus
  previewUrl?: string
  revisionId?: string
  guestArtifactToken?: string
}): ArtifactStatusData {
  return {
    id: input.artifactId,
    status: input.status,
    ...(input.previewUrl ? { previewUrl: input.previewUrl } : {}),
    ...(input.revisionId ? { revisionId: input.revisionId } : {}),
    ...(input.guestArtifactToken
      ? { guestArtifactToken: input.guestArtifactToken }
      : {})
  }
}

function buildArtifactPayload(input: {
  artifactId: string
  title: string
  status: ArtifactStatus
  previewUrl?: string
  revisionId?: string
  guestArtifactToken?: string
}): ArtifactData {
  return {
    id: input.artifactId,
    title: input.title,
    status: input.status,
    ...(input.previewUrl ? { previewUrl: input.previewUrl } : {}),
    ...(input.revisionId ? { revisionId: input.revisionId } : {}),
    ...(input.guestArtifactToken
      ? { guestArtifactToken: input.guestArtifactToken }
      : {})
  }
}

function validateSourceFiles(files: Record<string, string>) {
  const validatedFiles: Record<string, string> = {}
  const errors: Array<{
    code: string
    message: string
    line?: number
    importPath?: string
  }> = []

  for (const [filePath, content] of Object.entries(files)) {
    const validation = validateArtifactSource({ filePath, content })
    if (!validation.valid) {
      errors.push(...validation.errors)
      continue
    }

    validatedFiles[filePath] = validation.repairedContent ?? content
  }

  return {
    valid: errors.length === 0,
    errors,
    files: validatedFiles
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
  let artifact = await dbActions.createArtifactRecord({
    chatId: ctx.chatId,
    userId: ctx.userId,
    title: params.title,
    framework: 'react-spa',
    status: 'building'
  })

  ctx.emitArtifact(
    buildArtifactPayload({
      artifactId: artifact.id,
      title: params.title,
      status: 'building'
    })
  )
  ctx.emitArtifactStatus(
    buildStatusPayload({
      artifactId: artifact.id,
      status: 'building'
    })
  )

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
      ctx.userId
    )

    ctx.emitArtifactLog({
      artifactId: artifact.id,
      message: 'Writing template and source files...',
      level: 'info'
    })

    const templateFiles = await readTemplateFiles()
    await runtime.writeFiles({
      sandboxId: createdSession.sandboxId,
      files: {
        ...templateFiles,
        ...validation.files
      }
    })

    if (!shouldSkipInstall()) {
      ctx.emitArtifactLog({
        artifactId: artifact.id,
        message: 'Installing dependencies...',
        level: 'info'
      })
      await runtime.installDependencies({
        sandboxId: createdSession.sandboxId
      })
    }

    ctx.emitArtifactLog({
      artifactId: artifact.id,
      message: 'Starting preview...',
      level: 'info'
    })

    const preview = await runtime.startPreview({
      sandboxId: createdSession.sandboxId
    })

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
      ctx.userId
    )

    const revision =
      ctx.userId && ctx.triggeringMessageId
        ? await dbActions.appendArtifactRevision(
            {
              artifactId: artifact.id,
              triggeringMessageId: ctx.triggeringMessageId,
              promptSummary,
              title: params.title
            },
            ctx.userId
          )
        : null

    const guestArtifactToken = await issueGuestToken({
      ctx,
      artifactId: artifact.id,
      runtimeSession
    })

    ctx.emitArtifact(
      buildArtifactPayload({
        artifactId: artifact.id,
        title: params.title,
        status: 'ready',
        previewUrl: preview.previewUrl,
        ...(revision ? { revisionId: revision.id } : {}),
        ...(guestArtifactToken ? { guestArtifactToken } : {})
      })
    )
    ctx.emitArtifactStatus(
      buildStatusPayload({
        artifactId: artifact.id,
        status: 'ready',
        previewUrl: preview.previewUrl,
        ...(revision ? { revisionId: revision.id } : {}),
        ...(guestArtifactToken ? { guestArtifactToken } : {})
      })
    )

    logArtifactEvent('artifact.create.complete', {
      artifactId: artifact.id,
      chatId: ctx.chatId,
      isGuest: ctx.isGuest
    })

    return {
      success: true as const,
      title: params.title,
      description: params.description,
      files: validation.files,
      action: 'create' as const,
      artifactId: artifact.id,
      previewUrl: preview.previewUrl,
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
        ctx.userId
      )
    } else {
      artifact =
        (await dbActions.updateArtifactRecord(
          {
            id: artifact.id,
            status: 'failed'
          },
          ctx.userId
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
    ctx.emitArtifact(
      buildArtifactPayload({
        artifactId: artifact.id,
        title: params.title,
        status: 'failed',
        ...(guestArtifactToken ? { guestArtifactToken } : {})
      })
    )
    ctx.emitArtifactStatus(
      buildStatusPayload({
        artifactId: artifact.id,
        status: 'failed',
        ...(guestArtifactToken ? { guestArtifactToken } : {})
      })
    )

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

  ctx.emitArtifactStatus(
    buildStatusPayload({
      artifactId: existing.artifact.id,
      status: 'building'
    })
  )

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

    const revision =
      ctx.userId && ctx.triggeringMessageId
        ? await dbActions.appendArtifactRevision(
            {
              artifactId: existing.artifact.id,
              triggeringMessageId: ctx.triggeringMessageId,
              promptSummary,
              title
            },
            ctx.userId
          )
        : null

    const guestArtifactToken = await issueGuestToken({
      ctx,
      artifactId: existing.artifact.id,
      runtimeSession
    })

    ctx.emitArtifact(
      buildArtifactPayload({
        artifactId: existing.artifact.id,
        title,
        status: 'ready',
        ...(runtimeSession.previewUrl
          ? { previewUrl: runtimeSession.previewUrl }
          : {}),
        ...(revision ? { revisionId: revision.id } : {}),
        ...(guestArtifactToken ? { guestArtifactToken } : {})
      })
    )
    ctx.emitArtifactStatus(
      buildStatusPayload({
        artifactId: existing.artifact.id,
        status: 'ready',
        ...(runtimeSession.previewUrl
          ? { previewUrl: runtimeSession.previewUrl }
          : {}),
        ...(revision ? { revisionId: revision.id } : {}),
        ...(guestArtifactToken ? { guestArtifactToken } : {})
      })
    )

    return {
      success: true as const,
      title: params.title,
      description: params.description,
      files: validation.files,
      action: 'update' as const,
      artifactId: existing.artifact.id,
      previewUrl: runtimeSession.previewUrl ?? undefined,
      ...(revision ? { revisionId: revision.id } : {}),
      ...(guestArtifactToken ? { guestArtifactToken } : {})
    }
  } catch (error) {
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
    ctx.emitArtifactStatus(
      buildStatusPayload({
        artifactId: existing.artifact.id,
        status: 'failed'
      })
    )

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

  ctx.emitArtifactStatus(
    buildStatusPayload({
      artifactId: existing.artifact.id,
      status: 'restarting'
    })
  )

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

    ctx.emitArtifact(
      buildArtifactPayload({
        artifactId: existing.artifact.id,
        title: existing.artifact.title,
        status: 'ready',
        previewUrl: preview.previewUrl,
        ...(existing.artifact.currentRevisionId
          ? { revisionId: existing.artifact.currentRevisionId }
          : {}),
        ...(guestArtifactToken ? { guestArtifactToken } : {})
      })
    )
    ctx.emitArtifactStatus(
      buildStatusPayload({
        artifactId: existing.artifact.id,
        status: 'ready',
        previewUrl: preview.previewUrl,
        ...(existing.artifact.currentRevisionId
          ? { revisionId: existing.artifact.currentRevisionId }
          : {}),
        ...(guestArtifactToken ? { guestArtifactToken } : {})
      })
    )

    return {
      success: true as const,
      action: 'restart' as const,
      artifactId: existing.artifact.id,
      previewUrl: preview.previewUrl,
      ...(guestArtifactToken ? { guestArtifactToken } : {})
    }
  } catch (error) {
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
    ctx.emitArtifactStatus(
      buildStatusPayload({
        artifactId: existing.artifact.id,
        status: 'failed'
      })
    )

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

  ctx.emitArtifact(
    buildArtifactPayload({
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
  )
  ctx.emitArtifactStatus(
    buildStatusPayload({
      artifactId: existing.artifact.id,
      status: existing.runtimeSession?.status ?? existing.artifact.status,
      ...(existing.runtimeSession?.previewUrl
        ? { previewUrl: existing.runtimeSession.previewUrl }
        : {}),
      ...(existing.artifact.currentRevisionId
        ? { revisionId: existing.artifact.currentRevisionId }
        : {}),
      ...(guestArtifactToken ? { guestArtifactToken } : {})
    })
  )

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
