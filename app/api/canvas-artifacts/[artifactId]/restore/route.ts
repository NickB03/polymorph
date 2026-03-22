import { z } from 'zod'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  refreshGuestCanvasToken,
  verifyGuestCanvasToken
} from '@/lib/canvas/guest-token'
import { restoreCanvasArtifactVersion } from '@/lib/canvas/service'
import { checkAndEnforceCanvasLimit } from '@/lib/rate-limit/canvas-limits'
import { jsonError } from '@/lib/utils/json-error'

export const dynamic = 'force-dynamic'

const restoreRequestSchema = z.object({
  versionId: z.string().min(1),
  baseRevision: z.number().int().min(0),
  guestCanvasToken: z.string().min(1).optional()
})

async function maybeAttachRotatedGuestToken(
  responseBody: Record<string, unknown>,
  artifact: { chatId: string },
  artifactId: string
) {
  try {
    responseBody.guestCanvasToken = await refreshGuestCanvasToken({
      chatId: artifact.chatId,
      artifactId
    })
  } catch (error) {
    console.error('Canvas restore guest token rotation error:', error)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  try {
    const { artifactId } = await params
    const body = await req.json()
    const parsed = restoreRequestSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError('BAD_REQUEST', 'Invalid restore payload', 400)
    }
    const { versionId, baseRevision, guestCanvasToken } = parsed.data

    // Auth: Supabase session or guest token
    const userId = await getCurrentUserId()
    let isGuest = false
    let rateLimitId = userId ?? ''

    if (!userId && guestCanvasToken) {
      const payload = await verifyGuestCanvasToken(guestCanvasToken)
      if (!payload) {
        return jsonError('FORBIDDEN', 'Invalid or expired guest token', 403)
      }
      if (payload.artifactId !== artifactId) {
        return jsonError(
          'FORBIDDEN',
          'Guest token does not match this artifact',
          403
        )
      }
      isGuest = true
      rateLimitId = `guest:${payload.chatId}`
    } else if (!userId) {
      return jsonError('AUTH_REQUIRED', 'Authentication required', 401)
    }

    // Rate limit
    const limitResponse = await checkAndEnforceCanvasLimit(
      rateLimitId,
      'restore'
    )
    if (limitResponse) return limitResponse

    const result = await restoreCanvasArtifactVersion({
      artifactId,
      versionId,
      expectedRevision: baseRevision,
      userId: isGuest ? null : userId
    })

    if (!result.ok && result.errorCode === 'stale-revision') {
      return jsonError('CONFLICT', result.error ?? 'Stale revision', 409)
    }

    if (!result.ok) {
      const status = result.errorCode === 'not-found' ? 404 : 422
      return jsonError(
        result.errorCode?.toUpperCase() ?? 'ERROR',
        result.error ?? 'Restore failed',
        status
      )
    }

    const responseBody: Record<string, unknown> = { ...result.artifact }

    // Rotate guest token on successful restore
    if (isGuest && result.artifact) {
      await maybeAttachRotatedGuestToken(
        responseBody,
        result.artifact,
        artifactId
      )
    }

    return Response.json(responseBody)
  } catch (error) {
    console.error('Canvas restore error:', error)
    return jsonError('INTERNAL_ERROR', 'Error restoring canvas version', 500)
  }
}
