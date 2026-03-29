import { z } from 'zod'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  refreshGuestCanvasToken,
  verifyGuestCanvasToken
} from '@/lib/canvas/guest-token'
import { updateCanvasArtifactDraftFromSource } from '@/lib/canvas/service'
import { checkAndEnforceCanvasLimit } from '@/lib/rate-limit/canvas-limits'
import { jsonError } from '@/lib/utils/json-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const canvasSourceSchema = z.record(z.string().min(1), z.string())

const draftRequestSchema = z.object({
  baseRevision: z.number().int().min(0),
  draftSource: canvasSourceSchema,
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
    console.error('Canvas draft guest token rotation error:', error)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  try {
    const { artifactId } = await params
    const body = await req.json()
    const parsed = draftRequestSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError('BAD_REQUEST', 'Invalid draft update payload', 400)
    }
    const { baseRevision, draftSource, guestCanvasToken } = parsed.data

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
    const limitResponse = await checkAndEnforceCanvasLimit(rateLimitId, 'draft')
    if (limitResponse) return limitResponse

    const result = await updateCanvasArtifactDraftFromSource({
      artifactId,
      expectedRevision: baseRevision,
      draftSource,
      userId: isGuest ? null : userId
    })

    if (!result.ok && result.errorCode === 'stale-revision') {
      return jsonError('CONFLICT', result.error ?? 'Stale revision', 409)
    }

    if (!result.ok) {
      return jsonError(
        'COMPILE_FAILED',
        result.error ?? 'Compilation failed',
        422
      )
    }

    const responseBody: Record<string, unknown> = { ...result.artifact }

    // Rotate guest token on successful write
    if (isGuest && result.artifact) {
      await maybeAttachRotatedGuestToken(
        responseBody,
        result.artifact,
        artifactId
      )
    }

    return Response.json(responseBody)
  } catch (error) {
    console.error('Canvas draft update error:', error)
    return jsonError(
      'INTERNAL_ERROR',
      'Error updating canvas artifact draft',
      500
    )
  }
}
