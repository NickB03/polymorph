import { getCurrentUserId } from '@/lib/auth/get-current-user'
import {
  refreshGuestCanvasToken,
  verifyGuestCanvasToken
} from '@/lib/canvas/guest-token'
import { saveCanvasArtifactVersion } from '@/lib/canvas/service'
import { checkAndEnforceCanvasLimit } from '@/lib/rate-limit/canvas-limits'
import { jsonError } from '@/lib/utils/json-error'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  try {
    const { artifactId } = await params
    const body = await req.json()
    const { guestCanvasToken } = body

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
      'version'
    )
    if (limitResponse) return limitResponse

    const result = await saveCanvasArtifactVersion({
      artifactId,
      createdBy: 'user',
      userId: isGuest ? null : userId
    })

    if (!result.ok) {
      const status = result.errorCode === 'not-found' ? 404 : 422
      return jsonError(
        result.errorCode?.toUpperCase() ?? 'ERROR',
        result.error ?? 'Failed to create version',
        status
      )
    }

    const responseBody: Record<string, unknown> = { ...result.artifact }

    // Rotate guest token on successful write
    if (isGuest && result.artifact) {
      const newToken = await refreshGuestCanvasToken({
        chatId: result.artifact.chatId,
        artifactId
      })
      responseBody.guestCanvasToken = newToken
    }

    return Response.json(responseBody)
  } catch (error) {
    console.error('Canvas version creation error:', error)
    return jsonError('INTERNAL_ERROR', 'Error creating canvas version', 500)
  }
}
