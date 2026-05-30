import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { verifyGuestCanvasToken } from '@/lib/canvas/guest-token'
import { injectViewportFitStyles } from '@/lib/canvas/inject-viewport-fit'
import { exportCanvasArtifactHtml } from '@/lib/canvas/service'
import { getChat, loadCanvasArtifactByChatId } from '@/lib/db/actions'
import { jsonError } from '@/lib/utils/json-error'

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'canvas-artifact'
  )
}

async function getPublicArtifactOwnerUserId({
  artifactId,
  chatId,
  viewerUserId
}: {
  artifactId: string
  chatId: string
  viewerUserId?: string
}): Promise<string | null> {
  const chat = await getChat(chatId, viewerUserId)

  if (!chat || chat.visibility !== 'public') {
    return null
  }

  const artifact = await loadCanvasArtifactByChatId(chatId, chat.userId)
  if (!artifact || artifact.id !== artifactId) {
    return null
  }

  return chat.userId
}

/**
 * Shared handler for serving canvas artifact HTML.
 * Used by both the export (download) and view (inline) routes.
 */
export async function serveCanvasHtml(
  req: Request,
  artifactId: string,
  mode: 'inline' | 'download'
): Promise<Response> {
  const url = new URL(req.url)
  const guestToken = url.searchParams.get('guestCanvasToken')
  const publicChatId = url.searchParams.get('chatId')?.trim() || null

  const userId = (await getCurrentUserId()) ?? undefined
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
  } else if (!userId && !publicChatId) {
    return jsonError('AUTH_REQUIRED', 'Authentication required', 401)
  }

  let result: Awaited<ReturnType<typeof exportCanvasArtifactHtml>> | null = null

  if (isGuest) {
    result = await exportCanvasArtifactHtml({
      artifactId,
      userId: null
    })
  } else if (userId) {
    result = await exportCanvasArtifactHtml({
      artifactId,
      userId
    })
  }

  if ((!result || !result.ok) && publicChatId && !isGuest) {
    const ownerUserId = await getPublicArtifactOwnerUserId({
      artifactId,
      chatId: publicChatId,
      viewerUserId: userId
    })

    if (ownerUserId) {
      result = await exportCanvasArtifactHtml({
        artifactId,
        userId: ownerUserId
      })
    }
  }

  if (!result?.ok) {
    const errorCode = result?.errorCode ?? 'not-found'
    const status = errorCode === 'not-found' ? 404 : 422
    return jsonError(
      errorCode.toUpperCase(),
      result?.error ?? 'Artifact not found',
      status
    )
  }

  const headers = new Headers()
  headers.set(
    'Content-Disposition',
    mode === 'download'
      ? `attachment; filename="${slugify(result.title ?? 'canvas-artifact')}.html"`
      : 'inline'
  )
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
}
