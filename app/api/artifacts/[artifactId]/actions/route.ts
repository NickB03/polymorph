import { NextRequest } from 'next/server'

import { verifyGuestArtifactToken } from '@/lib/artifacts/guest-token'
import { createE2BRuntime } from '@/lib/artifacts/runtime'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { loadArtifactById, loadArtifactRuntimeSession } from '@/lib/db/actions'
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
  if (!action || (action !== 'refresh' && action !== 'retry')) {
    return jsonError('BAD_REQUEST', 'Unknown action', 400)
  }

  // Auth: try authenticated user first, fall back to guest token
  const userId = await getCurrentUserId()
  let isGuest = false
  let guestSandboxId: string | null = null

  if (!userId) {
    // Guest path: validate the signed guest artifact token
    const token = body.guestArtifactToken
    if (!token) {
      return jsonError('AUTH_REQUIRED', 'Authentication required', 401)
    }

    const handle = await verifyGuestArtifactToken(token)
    if (!handle || handle.artifactId !== artifactId) {
      return jsonError('AUTH_REQUIRED', 'Invalid or expired guest token', 401)
    }

    isGuest = true
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

      return Response.json({
        id: artifact.id,
        title: artifact.title,
        status: result.status,
        previewUrl: result.previewUrl,
        revisionId: artifact.currentRevisionId
      })
    } catch (error) {
      console.error('Failed to restart artifact preview:', error)
      return jsonError('RESTART_FAILED', 'Failed to restart preview', 500)
    }
  }

  // For refresh, just return the current status
  return Response.json({
    id: artifact.id,
    title: artifact.title,
    status: artifact.status,
    previewUrl: session?.previewUrl ?? null,
    revisionId: artifact.currentRevisionId
  })
}
