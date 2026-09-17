export const dynamic = 'force-dynamic'

import { updateMessageFeedback } from '@/lib/actions/feedback'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { annotatePhoenixUserFeedback } from '@/lib/observability/phoenix-feedback'
import { checkMessageFeedbackLimit } from '@/lib/rate-limit/feedback-limits'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { score, messageId } = body

    if (score === undefined || (score !== 1 && score !== -1)) {
      return new Response('score must be 1 (good) or -1 (bad)', {
        status: 400,
        statusText: 'Bad Request'
      })
    }

    if (!messageId || typeof messageId !== 'string') {
      return new Response('messageId is required', {
        status: 400,
        statusText: 'Bad Request'
      })
    }

    // Feedback writes to another user's message must be impossible: require a
    // signed-in user so the update always runs inside that user's RLS context.
    // getCurrentUserId also covers ENABLE_AUTH=false self-host installs; guests
    // resolve to undefined and are rejected.
    const userId = await getCurrentUserId()

    if (!userId) {
      return new Response('Sign in to send feedback', {
        status: 401,
        statusText: 'Unauthorized'
      })
    }

    const limitResult = await checkMessageFeedbackLimit(userId)
    if (!limitResult.allowed) {
      return new Response('Too many feedback submissions', {
        status: 429,
        statusText: 'Too Many Requests'
      })
    }

    const result = await updateMessageFeedback(messageId, score, userId)

    if (!result.success) {
      console.error('Error updating message feedback:', result.error)
      return result.notFound
        ? new Response('Unable to record feedback', {
            status: 404,
            statusText: 'Not Found'
          })
        : new Response('Error recording feedback', {
            status: 500,
            statusText: 'Internal Server Error'
          })
    }

    if (result.chatId) {
      try {
        await annotatePhoenixUserFeedback({
          chatId: result.chatId,
          messageId,
          score,
          metadata: result.metadata
        })
      } catch (error) {
        console.warn('[feedback] Phoenix annotation failed:', error)
      }
    }

    return new Response('Feedback recorded successfully', {
      status: 200
    })
  } catch (error) {
    console.error('Error recording feedback:', error)
    return new Response('Error recording feedback', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}
