export const dynamic = 'force-dynamic'

import { updateMessageFeedback } from '@/lib/actions/feedback'
import { annotatePhoenixUserFeedback } from '@/lib/observability/phoenix-feedback'
import { createClient } from '@/lib/supabase/server'

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

    // Get current user for RLS context
    let userId: string | null = null
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = await createClient()
      const {
        data: { user }
      } = await supabase.auth.getUser()
      userId = user?.id || null
    }

    // Update the message metadata with the feedback score using the action
    if (messageId) {
      const result = await updateMessageFeedback(messageId, score, userId)

      if (!result.success) {
        console.error('Error updating message feedback:', result.error)
        // Continue even if database update fails
      } else if (result.chatId) {
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
