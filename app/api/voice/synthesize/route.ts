import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { checkAndEnforceVoiceLimit } from '@/lib/rate-limit/voice-limits'
import { jsonError } from '@/lib/utils/json-error'
import {
  isVoiceEnabled,
  TTS_MAX_CHARS,
  VOICE_PROVIDER_TIMEOUT_MS
} from '@/lib/voice/config'
import {
  resolveProvider,
  synthesizeElevenLabs,
  synthesizeOpenAI
} from '@/lib/voice/tts-provider'

export const dynamic = 'force-dynamic'

async function withProviderTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    VOICE_PROVIDER_TIMEOUT_MS
  )

  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function POST(req: Request) {
  if (!isVoiceEnabled()) {
    return jsonError('FEATURE_DISABLED', 'Voice is not enabled', 404)
  }

  const userId = await getCurrentUserId()
  const guestChatEnabled = process.env.ENABLE_GUEST_CHAT === 'true'
  if (!userId && !guestChatEnabled) {
    return jsonError('AUTH_REQUIRED', 'Authentication required', 401)
  }

  const rateLimitId =
    userId ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'anonymous'
  const limitResponse = await checkAndEnforceVoiceLimit(rateLimitId)
  if (limitResponse) return limitResponse

  try {
    const { text, provider: preferredProvider, voiceId } = await req.json()

    if (!text || typeof text !== 'string') {
      return jsonError('BAD_REQUEST', 'text is required', 400)
    }

    const truncated = text.slice(0, TTS_MAX_CHARS)
    const provider = resolveProvider(preferredProvider)

    if (!provider) {
      // No server-side TTS available — client should use browser TTS
      return jsonError(
        'NO_PROVIDER',
        'No server-side TTS provider configured. Use browser TTS.',
        422
      )
    }

    let audioStream: ReadableStream<Uint8Array>
    let servedProvider = provider
    let noticeCode: string | null = null
    let noticeMessage: string | null = null

    if (provider === 'elevenlabs') {
      const voice =
        voiceId || process.env.ELEVENLABS_VOICE_ID || 'DXFkLCBUTmvXpp2QwZjA'
      try {
        audioStream = await withProviderTimeout(signal =>
          synthesizeElevenLabs(truncated, voice, signal)
        )
      } catch (elError) {
        if ((elError as Error).name === 'AbortError') {
          return jsonError('TTS_TIMEOUT', 'Speech synthesis timed out', 504)
        }

        console.warn('ElevenLabs TTS failed, trying OpenAI fallback:', elError)
        if (process.env.OPENAI_API_KEY) {
          audioStream = await withProviderTimeout(signal =>
            synthesizeOpenAI(truncated, 'alloy', signal)
          )
          servedProvider = 'openai'
          noticeCode = 'provider-fallback'
          noticeMessage = 'Voice fallback: switched to OpenAI.'
        } else {
          throw elError
        }
      }
    } else {
      // OpenAI
      audioStream = await withProviderTimeout(signal =>
        synthesizeOpenAI(truncated, voiceId || 'alloy', signal)
      )
    }

    return new Response(audioStream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'x-tts-provider': servedProvider,
        ...(noticeCode ? { 'x-tts-notice': noticeCode } : {}),
        ...(noticeMessage ? { 'x-tts-notice-message': noticeMessage } : {})
      }
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return jsonError('TTS_TIMEOUT', 'Speech synthesis timed out', 504)
    }

    // Detail (which can embed the upstream provider's raw HTTP error body)
    // stays server-side; the client gets a fixed generic message.
    console.error('TTS synthesis error:', error)
    return jsonError('TTS_ERROR', 'Speech synthesis failed', 500)
  }
}
