import { createClient } from '@arizeai/phoenix-client'
import { addSessionAnnotation } from '@arizeai/phoenix-client/sessions'

import type { UIMessageMetadata } from '@/lib/types/ai'

import 'server-only'

function getPhoenixBaseUrl(): string | null {
  const endpoint = process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim()
  if (!endpoint) return null
  return endpoint.replace(/\/v1\/traces\/?$/, '').replace(/\/$/, '')
}

export async function annotatePhoenixUserFeedback({
  chatId,
  messageId,
  score,
  metadata
}: {
  chatId: string
  messageId: string
  score: 1 | -1
  metadata?: UIMessageMetadata | null
}): Promise<void> {
  const baseUrl = getPhoenixBaseUrl()
  if (!baseUrl) return

  const apiKey = process.env.PHOENIX_API_KEY?.trim()
  const client = createClient({
    options: {
      baseUrl,
      ...(apiKey
        ? {
            headers: {
              Authorization: `Bearer ${apiKey}`
            }
          }
        : {})
    }
  })

  await addSessionAnnotation({
    client,
    sessionAnnotation: {
      sessionId: chatId,
      name: 'user_feedback',
      annotatorKind: 'HUMAN',
      label: score === 1 ? 'thumbs_up' : 'thumbs_down',
      score,
      identifier: messageId,
      metadata: {
        messageId,
        ...(metadata?.correlationId
          ? { correlationId: metadata.correlationId }
          : {}),
        ...(metadata?.otelTraceId ? { otelTraceId: metadata.otelTraceId } : {}),
        ...(metadata?.traceId ? { legacyTraceId: metadata.traceId } : {})
      }
    }
  })
}
