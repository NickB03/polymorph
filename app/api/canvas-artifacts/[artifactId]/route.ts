import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { verifyGuestCanvasToken } from '@/lib/canvas/guest-token'
import { loadCanvasArtifactState } from '@/lib/canvas/service'
import { jsonError } from '@/lib/utils/json-error'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  try {
    const { artifactId } = await params
    const url = new URL(req.url)
    const guestToken = url.searchParams.get('guestCanvasToken')

    // Auth: Supabase session or guest token
    const userId = await getCurrentUserId()
    let isGuest = false

    if (!userId && guestToken) {
      const payload = await verifyGuestCanvasToken(guestToken)
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
    } else if (!userId) {
      return jsonError('AUTH_REQUIRED', 'Authentication required', 401)
    }

    const state = await loadCanvasArtifactState({
      artifactId,
      userId: isGuest ? null : userId
    })

    if (!state) {
      return jsonError('NOT_FOUND', 'Artifact not found', 404)
    }

    // Verify guest token chatId matches artifact
    if (isGuest && guestToken) {
      const payload = await verifyGuestCanvasToken(guestToken)
      if (payload && payload.chatId !== state.chatId) {
        return jsonError(
          'FORBIDDEN',
          'Guest token does not match this artifact',
          403
        )
      }
    }

    return Response.json(state)
  } catch (error) {
    console.error('Canvas artifact load error:', error)
    return jsonError('INTERNAL_ERROR', 'Error loading canvas artifact', 500)
  }
}
