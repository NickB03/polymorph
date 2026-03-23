import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { jsonError } from '@/lib/utils/json-error'
import { isVoiceEnabled, TTS_MAX_CHARS } from '@/lib/voice/config'
import {
  resolveProvider,
  synthesizeElevenLabs,
  synthesizeOpenAI
} from '@/lib/voice/tts-provider'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!isVoiceEnabled()) {
    return jsonError('FEATURE_DISABLED', 'Voice is not enabled', 404)
  }

  const userId = await getCurrentUserId()
  const guestChatEnabled = process.env.ENABLE_GUEST_CHAT === 'true'
  if (!userId && !guestChatEnabled) {
    return jsonError('AUTH_REQUIRED', 'Authentication required', 401)
  }

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

    if (provider === 'elevenlabs') {
      const voice =
        voiceId || process.env.ELEVENLABS_VOICE_ID || 'DXFkLCBUTmvXpp2QwZjA'
      try {
        audioStream = await synthesizeElevenLabs(truncated, voice)
      } catch (elError) {
        console.warn('ElevenLabs TTS failed, trying OpenAI fallback:', elError)
        if (process.env.OPENAI_API_KEY) {
          audioStream = await synthesizeOpenAI(truncated, 'alloy')
          servedProvider = 'openai'
        } else {
          throw elError
        }
      }
    } else {
      // OpenAI
      audioStream = await synthesizeOpenAI(truncated, voiceId || 'alloy')
    }

    return new Response(audioStream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'x-tts-provider': servedProvider
      }
    })
  } catch (error) {
    console.error('TTS synthesis error:', error)
    return jsonError(
      'TTS_ERROR',
      `Speech synthesis failed: ${(error as Error).message}`,
      500
    )
  }
}
