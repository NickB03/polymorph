import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { verifyGuestCanvasToken } from '@/lib/canvas/guest-token'
import { loadCanvasArtifactState } from '@/lib/canvas/service'
import { getChat, loadCanvasArtifactByChatId } from '@/lib/db/actions'
import { jsonError } from '@/lib/utils/json-error'

export const dynamic = 'force-dynamic'

async function loadPublicChatArtifactState({
  artifactId,
  chatId,
  viewerUserId
}: {
  artifactId: string
  chatId: string
  viewerUserId?: string
}): Promise<Awaited<ReturnType<typeof loadCanvasArtifactState>>> {
  const chat = await getChat(chatId, viewerUserId)

  if (!chat || chat.visibility !== 'public') {
    return null
  }

  const artifact = await loadCanvasArtifactByChatId(chatId, chat.userId)
  if (!artifact || artifact.id !== artifactId) {
    return null
  }

  return loadCanvasArtifactState({
    artifactId,
    userId: chat.userId
  })
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  try {
    const { artifactId } = await params
    const url = new URL(req.url)
    const guestToken = url.searchParams.get('guestCanvasToken')
    const publicChatId = url.searchParams.get('chatId')?.trim() || null

    // Auth: Supabase session or guest token
    const userId = (await getCurrentUserId()) ?? undefined
    let isGuest = false
    let guestPayload: Awaited<ReturnType<typeof verifyGuestCanvasToken>> = null

    if (!userId && guestToken) {
      guestPayload = await verifyGuestCanvasToken(guestToken)
      if (!guestPayload) {
        return jsonError('FORBIDDEN', 'Invalid or expired guest token', 403)
      }
      if (guestPayload.artifactId !== artifactId) {
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

    let state: Awaited<ReturnType<typeof loadCanvasArtifactState>> = null

    if (isGuest) {
      state = await loadCanvasArtifactState({
        artifactId,
        userId: null
      })
    } else if (userId) {
      state = await loadCanvasArtifactState({
        artifactId,
        userId
      })
    }

    if (!state && publicChatId && !isGuest) {
      state = await loadPublicChatArtifactState({
        artifactId,
        chatId: publicChatId,
        viewerUserId: userId
      })
    }

    if (!state) {
      return jsonError('NOT_FOUND', 'Artifact not found', 404)
    }

    // Verify guest token chatId matches artifact
    if (isGuest && guestPayload && guestPayload.chatId !== state.chatId) {
      return jsonError(
        'FORBIDDEN',
        'Guest token does not match this artifact',
        403
      )
    }

    return Response.json(state)
  } catch (error) {
    console.error('Canvas artifact load error:', error)
    return jsonError('INTERNAL_ERROR', 'Error loading canvas artifact', 500)
  }
}
