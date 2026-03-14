import { NextRequest } from 'next/server'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { loadArtifactById, loadArtifactRuntimeSession } from '@/lib/db/actions'
import { jsonError } from '@/lib/utils/json-error'

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ artifactId: string }> }
) {
  const { artifactId } = await props.params

  let body: { action?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('BAD_REQUEST', 'Invalid JSON body', 400)
  }

  const { action } = body
  if (!action || (action !== 'refresh' && action !== 'retry')) {
    return jsonError('BAD_REQUEST', 'Unknown action', 400)
  }

  // Auth: require authenticated user for persisted artifacts
  const userId = await getCurrentUserId()
  if (!userId) {
    return jsonError('AUTH_REQUIRED', 'Authentication required', 401)
  }

  // Load artifact with RLS (ensures user owns it)
  const artifact = await loadArtifactById(artifactId, userId)
  if (!artifact) {
    return jsonError('NOT_FOUND', 'Artifact not found', 404)
  }

  // Load the current runtime session
  const session = await loadArtifactRuntimeSession(artifactId, userId)

  const payload = {
    id: artifact.id,
    title: artifact.title,
    status: artifact.status,
    previewUrl: session?.previewUrl ?? null,
    revisionId: artifact.currentRevisionId
  }

  return Response.json(payload)
}
