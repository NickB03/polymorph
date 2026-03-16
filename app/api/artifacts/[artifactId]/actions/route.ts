import { NextRequest } from 'next/server'

import { Sandbox } from 'e2b'

import {
  getTtlMs,
  signGuestArtifactToken,
  verifyGuestArtifactToken,
  verifyGuestArtifactTokenAllowExpired
} from '@/lib/artifacts/guest-token'
import { createE2BRuntime } from '@/lib/artifacts/runtime'
import { isSandboxNotFoundError } from '@/lib/artifacts/runtime/errors'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  loadArtifactById,
  loadArtifactRuntimeSession,
  loadLatestRevisionWithSource,
  upsertArtifactRuntimeSession
} from '@/lib/db/actions'
import { jsonError } from '@/lib/utils/json-error'

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ artifactId: string }> }
) {
  const { artifactId } = await props.params

  let body: { action?: string; guestArtifactToken?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('BAD_REQUEST', 'Invalid JSON body', 400)
  }

  const { action } = body
  if (!action || !['refresh', 'retry', 'rebuild'].includes(action)) {
    return jsonError('BAD_REQUEST', 'Unknown action', 400)
  }

  // Auth: try authenticated user first, fall back to guest token
  const userId = await getCurrentUserId()
  let isGuest = false
  let guestHandle: Awaited<ReturnType<typeof verifyGuestArtifactToken>> = null
  let guestSandboxId: string | null = null

  if (!userId) {
    // Guest path: validate the signed guest artifact token
    const token = body.guestArtifactToken
    if (!token) {
      return jsonError('AUTH_REQUIRED', 'Authentication required', 401)
    }

    let handle = await verifyGuestArtifactToken(token)

    // For rebuild: accept expired tokens (signature still proves identity)
    if (!handle && action === 'rebuild') {
      handle = await verifyGuestArtifactTokenAllowExpired(token)
    }

    // For non-rebuild actions: detect expired tokens and return a specific code
    if (!handle && action !== 'rebuild') {
      const expiredHandle = await verifyGuestArtifactTokenAllowExpired(token)
      if (expiredHandle && expiredHandle.artifactId === artifactId) {
        return jsonError(
          'TOKEN_EXPIRED',
          'Session expired — rebuild to continue',
          401
        )
      }
    }

    if (!handle || handle.artifactId !== artifactId) {
      return jsonError('AUTH_REQUIRED', 'Invalid or expired guest token', 401)
    }

    isGuest = true
    guestHandle = handle
    guestSandboxId = handle.sandboxId
  }

  // Load artifact — pass userId for RLS on persisted chats, null for guest
  const artifact = await loadArtifactById(artifactId, isGuest ? null : userId)
  if (!artifact) {
    return jsonError('NOT_FOUND', 'Artifact not found', 404)
  }

  // Load the current runtime session
  const session = await loadArtifactRuntimeSession(
    artifactId,
    isGuest ? null : userId
  )

  const issueGuestArtifactToken = async (input?: {
    runtimeSessionId?: string
    sandboxId?: string
    expiresAt?: Date | null
  }) => {
    if (!isGuest || !guestHandle) return undefined

    return signGuestArtifactToken({
      artifactId: artifact.id,
      runtimeSessionId: input?.runtimeSessionId ?? guestHandle.runtimeSessionId,
      sandboxId: input?.sandboxId ?? guestHandle.sandboxId,
      chatId: artifact.chatId,
      expiresAt: (input?.expiresAt ?? guestHandle.expiresAt).getTime()
    })
  }

  // For rebuild, spin up a fresh sandbox from the latest stored source
  if (action === 'rebuild') {
    try {
      const { rebuildArtifactFromRevision } =
        await import('@/lib/artifacts/rebuild')
      const result = await rebuildArtifactFromRevision({
        artifactId,
        userId: isGuest ? null : (userId ?? null)
      })

      if (!result.success) {
        const status = result.alreadyInProgress ? 409 : 500
        const code = result.alreadyInProgress
          ? 'REBUILD_IN_PROGRESS'
          : 'REBUILD_FAILED'
        return jsonError(code, result.error, status)
      }

      // Issue a FRESH guest token with new expiry
      const guestArtifactToken = await issueGuestArtifactToken({
        runtimeSessionId: result.runtimeSessionId,
        sandboxId: result.sandboxId,
        expiresAt: new Date(Date.now() + getTtlMs())
      })

      return Response.json({
        id: artifact.id,
        title: artifact.title,
        status: result.status,
        previewUrl: result.previewUrl,
        revisionId: artifact.currentRevisionId,
        canRebuild: true,
        ...(guestArtifactToken ? { guestArtifactToken } : {})
      })
    } catch (error) {
      console.error('Failed to rebuild artifact:', error)
      return jsonError('REBUILD_FAILED', 'Failed to rebuild artifact', 500)
    }
  }

  // For retry, actually restart the preview via the runtime adapter
  if (action === 'retry') {
    const sandboxId = isGuest ? guestSandboxId : session?.sandboxId

    if (!sandboxId) {
      return jsonError(
        'NO_SESSION',
        'No active runtime session to restart',
        404
      )
    }

    try {
      const runtime = createE2BRuntime()
      const result = await runtime.restartPreview({ sandboxId })
      const persistedSession = await upsertArtifactRuntimeSession(
        {
          id: session?.id ?? guestHandle?.runtimeSessionId,
          artifactId: artifact.id,
          provider: 'e2b',
          sandboxId,
          previewUrl: result.previewUrl,
          status: result.status,
          startedAt: session?.startedAt ?? new Date(),
          expiresAt: session?.expiresAt ?? guestHandle?.expiresAt ?? null,
          lastHeartbeatAt: new Date()
        },
        isGuest ? null : userId
      )
      const guestArtifactToken = await issueGuestArtifactToken({
        runtimeSessionId: persistedSession?.id,
        sandboxId,
        expiresAt: persistedSession?.expiresAt
      })

      return Response.json({
        id: artifact.id,
        title: artifact.title,
        status: result.status,
        previewUrl: result.previewUrl,
        revisionId: artifact.currentRevisionId,
        ...(guestArtifactToken ? { guestArtifactToken } : {})
      })
    } catch (error) {
      // Sandbox gone — persist expired state, then return 410 for rebuild UI
      if (isSandboxNotFoundError(error)) {
        if (session) {
          await upsertArtifactRuntimeSession(
            {
              id: session.id,
              artifactId: artifact.id,
              provider: 'e2b',
              sandboxId: session.sandboxId,
              previewUrl: null,
              status: 'expired',
              startedAt: session.startedAt,
              expiresAt: session.expiresAt,
              lastHeartbeatAt: new Date()
            },
            isGuest ? null : userId
          )
        }
        return jsonError(
          'SANDBOX_EXPIRED',
          'Sandbox has expired — rebuild to continue',
          410
        )
      }
      console.error('Failed to restart artifact preview:', error)
      return jsonError('RESTART_FAILED', 'Failed to restart preview', 500)
    }
  }

  // For refresh, just return the current status
  const guestArtifactToken = await issueGuestArtifactToken({
    runtimeSessionId: session?.id,
    sandboxId: session?.sandboxId,
    expiresAt: session?.expiresAt
  })

  // Check if the latest revision has stored source files (rebuild-capable)
  const latestRevision = await loadLatestRevisionWithSource(
    artifactId,
    isGuest ? null : userId
  )
  const canRebuild = latestRevision?.sourceFiles != null

  // Liveness probe: verify the sandbox is still alive when status looks ready.
  // Cost: ~100ms single API call. Benefit: user sees "expired + rebuild"
  // immediately instead of waiting for the iframe ceiling timeout.
  const sandboxId = session?.sandboxId
  if (
    sandboxId &&
    session?.status === 'ready' &&
    artifact.status !== 'expired'
  ) {
    try {
      await Sandbox.connect(sandboxId)
    } catch (probeError) {
      if (isSandboxNotFoundError(probeError)) {
        await upsertArtifactRuntimeSession(
          {
            id: session.id,
            artifactId: artifact.id,
            provider: 'e2b',
            sandboxId,
            previewUrl: null,
            status: 'expired',
            startedAt: session.startedAt,
            expiresAt: session.expiresAt,
            lastHeartbeatAt: new Date()
          },
          isGuest ? null : userId
        )

        return Response.json({
          id: artifact.id,
          title: artifact.title,
          status: 'expired',
          previewUrl: null,
          revisionId: artifact.currentRevisionId,
          canRebuild,
          ...(guestArtifactToken ? { guestArtifactToken } : {})
        })
      }
      // Non-sandbox errors (network blip, etc.) — fall through to normal response
    }
  }

  return Response.json({
    id: artifact.id,
    title: artifact.title,
    status: artifact.status,
    previewUrl: session?.previewUrl ?? null,
    revisionId: artifact.currentRevisionId,
    canRebuild,
    ...(guestArtifactToken ? { guestArtifactToken } : {})
  })
}
