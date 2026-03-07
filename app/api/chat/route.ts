import { revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'

import { loadChat } from '@/lib/actions/chat'
import { calculateConversationTurn, trackChatEvent } from '@/lib/analytics'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { checkAndEnforceOverallChatLimit } from '@/lib/rate-limit/chat-limits'
import { checkAndEnforceGuestLimit } from '@/lib/rate-limit/guest-limit'
import { createChatStreamResponse } from '@/lib/streaming/create-chat-stream-response'
import { createEphemeralChatStreamResponse } from '@/lib/streaming/create-ephemeral-chat-stream-response'
import { SearchMode } from '@/lib/types/search'
import { jsonError } from '@/lib/utils/json-error'
import { selectModel } from '@/lib/utils/model-selection'
import { perfLog, perfTime } from '@/lib/utils/perf-logging'
import { resetAllCounters } from '@/lib/utils/perf-tracking'
import { isProviderEnabled } from '@/lib/utils/registry'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  const startTime = performance.now()
  const abortSignal = req.signal

  // Reset counters for new request (development only)
  if (process.env.ENABLE_PERF_LOGGING === 'true') {
    resetAllCounters()
  }

  try {
    const body = await req.json()
    const {
      message,
      messages,
      chatId,
      trigger,
      messageId,
      isNewChat,
      toolResult
    } = body

    perfLog(
      `API Route - Start: chatId=${chatId}, trigger=${trigger}, isNewChat=${isNewChat}`
    )

    // Validate trigger value
    const VALID_TRIGGERS = [
      'submit-message',
      'regenerate-message',
      'tool-result'
    ] as const
    type Trigger = (typeof VALID_TRIGGERS)[number]

    if (trigger && !VALID_TRIGGERS.includes(trigger)) {
      return jsonError('BAD_REQUEST', `Unknown trigger: ${trigger}`, 400)
    }
    const validatedTrigger: Trigger | undefined = trigger

    // Handle different triggers using AI SDK standard values
    if (validatedTrigger === 'regenerate-message') {
      if (!messageId) {
        return jsonError(
          'BAD_REQUEST',
          'messageId is required for regeneration',
          400
        )
      }
    } else if (validatedTrigger === 'tool-result') {
      if (
        !toolResult ||
        typeof toolResult.toolCallId !== 'string' ||
        !toolResult.toolCallId ||
        !('output' in toolResult)
      ) {
        return jsonError(
          'BAD_REQUEST',
          'toolResult with toolCallId and output is required',
          400
        )
      }
      console.log(
        `[tool-result] Received continuation: chatId=${chatId}, toolCallId=${toolResult.toolCallId}`
      )
    } else if (validatedTrigger === 'submit-message') {
      if (!message) {
        return jsonError(
          'BAD_REQUEST',
          'message is required for submission',
          400
        )
      }
    }

    const referer = req.headers.get('referer')
    const isSharePage = referer?.includes('/share/')

    const authStart = performance.now()
    const userId = await getCurrentUserId()
    perfTime('Auth completed', authStart)

    if (isSharePage) {
      return jsonError(
        'FORBIDDEN',
        'Chat API is not available on share pages',
        403
      )
    }

    const guestChatEnabled = process.env.ENABLE_GUEST_CHAT === 'true'
    const isGuest = !userId
    if (isGuest && !guestChatEnabled) {
      return jsonError('AUTH_REQUIRED', 'Authentication required', 401)
    }

    if (isGuest) {
      // NOTE: X-Forwarded-For is trusted because this runs behind Vercel's
      // edge network, which overwrites the header. If deploying elsewhere,
      // validate the proxy chain or use a platform-specific header.
      const forwardedFor = req.headers.get('x-forwarded-for') || ''
      const ip =
        forwardedFor.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        null
      const guestLimitResponse = await checkAndEnforceGuestLimit(ip)
      if (guestLimitResponse) return guestLimitResponse
    }

    const cookieStore = await cookies()

    // Get search mode from cookie (with backward compat for old values)
    const rawSearchMode = cookieStore.get('searchMode')?.value
    const mappedSearchMode =
      rawSearchMode === 'quick'
        ? 'chat'
        : rawSearchMode === 'adaptive'
          ? 'research'
          : rawSearchMode
    const searchMode: SearchMode =
      mappedSearchMode && ['chat', 'research'].includes(mappedSearchMode)
        ? (mappedSearchMode as SearchMode)
        : 'chat'

    // Select the appropriate model based on model type preference and search mode
    const selectedModel = selectModel({
      cookieStore,
      searchMode
    })

    if (!isProviderEnabled(selectedModel.providerId)) {
      return jsonError(
        'PROVIDER_UNAVAILABLE',
        `Provider not enabled: ${selectedModel.providerId}`,
        404
      )
    }

    // Resolve model type from cookie
    const modelTypeCookie = cookieStore.get('modelType')?.value
    const modelType =
      modelTypeCookie === 'quality' || modelTypeCookie === 'speed'
        ? modelTypeCookie
        : undefined
    if (!isGuest) {
      const overallLimitResponse = await checkAndEnforceOverallChatLimit(userId)
      if (overallLimitResponse) return overallLimitResponse
    }

    const streamStart = performance.now()
    perfLog(
      `createChatStreamResponse - Start: model=${selectedModel.providerId}:${selectedModel.id}, searchMode=${searchMode}, modelType=${modelType}`
    )

    // Validate guest messages shape at the system boundary
    if (isGuest) {
      if (
        !Array.isArray(messages) ||
        messages.length === 0 ||
        !messages.every(
          (m: any) =>
            (m.role === 'user' || m.role === 'assistant') &&
            Array.isArray(m.parts) &&
            m.parts.length > 0
        )
      ) {
        return jsonError(
          'BAD_REQUEST',
          'Invalid messages: expected non-empty array with valid role and parts',
          400
        )
      }
    }

    const response = isGuest
      ? await createEphemeralChatStreamResponse({
          messages,
          model: selectedModel,
          abortSignal,
          searchMode,
          modelType,
          chatId,
          trigger: validatedTrigger
        })
      : await createChatStreamResponse({
          message: validatedTrigger === 'tool-result' ? null : message,
          model: selectedModel,
          chatId,
          userId: userId, // userId is guaranteed to be non-null after authentication check above
          trigger: validatedTrigger,
          messageId,
          abortSignal,
          isNewChat,
          searchMode,
          modelType,
          ...(validatedTrigger === 'tool-result' ? { toolResult } : {})
        })

    perfTime('createChatStreamResponse resolved', streamStart)

    // Track analytics event (non-blocking)
    // Calculate conversation turn by loading chat history
    ;(async () => {
      try {
        let conversationTurn = 1 // Default for new chats

        // For existing chats, load history and calculate turn number
        if (!isNewChat && !isGuest) {
          const chat = await loadChat(chatId, userId)
          if (chat?.messages) {
            // Add 1 to account for the current message being sent
            conversationTurn = calculateConversationTurn(chat.messages) + 1
          }
        }

        if (!isGuest && userId) {
          await trackChatEvent({
            searchMode,
            modelType: modelTypeCookie === 'quality' ? 'quality' : 'speed',
            conversationTurn,
            isNewChat: isNewChat ?? false,
            trigger: validatedTrigger ?? 'submit-message',
            chatId,
            userId,
            modelId: selectedModel.id
          })
        }
      } catch (error) {
        // Log error but don't throw - analytics should never break the app
        console.error('Analytics tracking failed:', error)
      }
    })()

    // Invalidate the cache for this specific chat after creating the response
    // This ensures the next load will get fresh data
    if (chatId && !isGuest) {
      revalidateTag(`chat-${chatId}`, 'max')
    }

    const totalTime = performance.now() - startTime
    perfLog(`Total API route time: ${totalTime.toFixed(2)}ms`)
    perfLog(`=== Summary ===`)
    perfLog(`Chat Type: ${isNewChat ? 'NEW' : 'EXISTING'}`)
    perfLog(`Total Time: ${totalTime.toFixed(2)}ms`)
    perfLog(`================`)

    return response
  } catch (error) {
    console.error('API route error:', error)
    return jsonError('INTERNAL_ERROR', 'Error processing your request', 500)
  }
}
