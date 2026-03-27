import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { verifyGuestCanvasToken } from '@/lib/canvas/guest-token'
import { injectViewportFitStyles } from '@/lib/canvas/inject-viewport-fit'
import { exportCanvasArtifactHtml } from '@/lib/canvas/service'
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

    const result = await exportCanvasArtifactHtml({
      artifactId,
      userId: isGuest ? null : userId
    })

    if (!result.ok) {
      const status = result.errorCode === 'not-found' ? 404 : 422
      return jsonError(
        result.errorCode?.toUpperCase() ?? 'ERROR',
        result.error ?? 'Export failed',
        status
      )
    }

    const headers = new Headers()
    headers.set('Content-Disposition', 'inline')
    headers.set('Content-Type', 'text/html; charset=utf-8')
    headers.set('X-Canvas-Executes-JavaScript', 'true')
    headers.set(
      'X-Canvas-External-Dependencies',
      result.hasExternalDependencies ? 'present' : 'none'
    )

    return new Response(injectViewportFitStyles(result.html ?? ''), {
      status: 200,
      headers
    })
  } catch (error) {
    console.error('Canvas view error:', error)
    return jsonError('INTERNAL_ERROR', 'Error viewing canvas artifact', 500)
  }
}
