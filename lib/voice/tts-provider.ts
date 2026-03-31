import type { TTSProvider } from './config'

function validateAudioContentType(response: Response, provider: string): void {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('audio') && !contentType.includes('octet-stream')) {
    throw new Error(
      `${provider} returned unexpected Content-Type: ${contentType}`
    )
  }
}

/**
 * Resolve the best available TTS provider based on configured API keys.
 * Falls through: ElevenLabs → OpenAI → browser (client-only, returns null).
 */
export function resolveProvider(preferred?: TTSProvider): TTSProvider | null {
  if (preferred === 'browser') return null // handled client-side
  if (preferred === 'elevenlabs' && process.env.ELEVENLABS_API_KEY?.trim()) {
    return 'elevenlabs'
  }
  if (preferred === 'openai' && process.env.OPENAI_API_KEY?.trim()) {
    return 'openai'
  }
  // Auto-resolve: try ElevenLabs first, then OpenAI
  if (process.env.ELEVENLABS_API_KEY?.trim()) return 'elevenlabs'
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai'
  return null // caller should fall back to browser TTS
}

/**
 * Synthesize speech via ElevenLabs streaming API.
 * Returns a ReadableStream of audio/mpeg bytes.
 */
export async function synthesizeElevenLabs(
  text: string,
  voiceId: string,
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured')

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      signal,
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`)
  }

  validateAudioContentType(response, 'ElevenLabs')

  if (!response.body) {
    throw new Error('ElevenLabs returned no audio stream')
  }

  return response.body
}

/**
 * Synthesize speech via OpenAI TTS API.
 * Returns a ReadableStream of audio/mpeg bytes.
 */
export async function synthesizeOpenAI(
  text: string,
  voice = 'alloy',
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    signal,
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice,
      response_format: 'mp3'
    })
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`OpenAI TTS error ${response.status}: ${errorText}`)
  }

  validateAudioContentType(response, 'OpenAI')

  if (!response.body) {
    throw new Error('OpenAI returned no audio stream')
  }

  return response.body
}
