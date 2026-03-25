import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getCurrentUserId,
  jsonError,
  isVoiceEnabled,
  resolveProvider,
  synthesizeElevenLabs,
  synthesizeOpenAI
} = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  jsonError: vi.fn(
    (code: string, message: string, status: number) =>
      new Response(JSON.stringify({ error: code, message }), { status })
  ),
  isVoiceEnabled: vi.fn(),
  resolveProvider: vi.fn(),
  synthesizeElevenLabs: vi.fn(),
  synthesizeOpenAI: vi.fn()
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId
}))

vi.mock('@/lib/utils/json-error', () => ({
  jsonError
}))

vi.mock('@/lib/voice/config', () => ({
  isVoiceEnabled,
  TTS_MAX_CHARS: 20,
  VOICE_PROVIDER_TIMEOUT_MS: 50
}))

vi.mock('@/lib/voice/tts-provider', () => ({
  resolveProvider,
  synthesizeElevenLabs,
  synthesizeOpenAI
}))

import { POST } from './route'

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/voice/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

function makeStream() {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]))
      controller.close()
    }
  })
}

async function readJson(response: Response) {
  return response.json() as Promise<{ error: string; message: string }>
}

describe('POST /api/voice/synthesize', () => {
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY
  const originalGuestChat = process.env.ENABLE_GUEST_CHAT

  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentUserId.mockResolvedValue('user-123')
    isVoiceEnabled.mockReturnValue(true)
    resolveProvider.mockReturnValue('elevenlabs')
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.ENABLE_GUEST_CHAT = 'true'
  })

  afterEach(() => {
    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey
    }

    if (originalGuestChat === undefined) {
      delete process.env.ENABLE_GUEST_CHAT
    } else {
      process.env.ENABLE_GUEST_CHAT = originalGuestChat
    }
  })

  it('returns 404 when voice is disabled', async () => {
    isVoiceEnabled.mockReturnValueOnce(false)

    const response = await POST(createRequest({ text: 'hello' }))

    expect(response.status).toBe(404)
    await expect(readJson(response)).resolves.toEqual({
      error: 'FEATURE_DISABLED',
      message: 'Voice is not enabled'
    })
  })

  it('returns 401 for guests when guest chat is disabled', async () => {
    getCurrentUserId.mockResolvedValueOnce(null)
    process.env.ENABLE_GUEST_CHAT = 'false'

    const response = await POST(createRequest({ text: 'hello' }))

    expect(response.status).toBe(401)
    await expect(readJson(response)).resolves.toEqual({
      error: 'AUTH_REQUIRED',
      message: 'Authentication required'
    })
  })

  it('returns 400 when text is missing or not a string', async () => {
    const missingText = await POST(createRequest({ provider: 'openai' }))
    const invalidText = await POST(createRequest({ text: 42 }))

    expect(missingText.status).toBe(400)
    await expect(readJson(missingText)).resolves.toEqual({
      error: 'BAD_REQUEST',
      message: 'text is required'
    })

    expect(invalidText.status).toBe(400)
    await expect(readJson(invalidText)).resolves.toEqual({
      error: 'BAD_REQUEST',
      message: 'text is required'
    })
  })

  it('returns 422 when no server provider is available', async () => {
    resolveProvider.mockReturnValueOnce(null)

    const response = await POST(
      createRequest({
        text: 'hello world',
        provider: 'browser'
      })
    )

    expect(response.status).toBe(422)
    await expect(readJson(response)).resolves.toEqual({
      error: 'NO_PROVIDER',
      message: 'No server-side TTS provider configured. Use browser TTS.'
    })
  })

  it('truncates long text before provider calls', async () => {
    resolveProvider.mockReturnValueOnce('openai')
    synthesizeOpenAI.mockResolvedValueOnce(makeStream())

    const response = await POST(
      createRequest({
        text: '01234567890123456789012345',
        provider: 'openai',
        voiceId: 'nova'
      })
    )

    expect(response.status).toBe(200)
    expect(synthesizeOpenAI).toHaveBeenCalledWith(
      '01234567890123456789',
      'nova',
      expect.objectContaining({ aborted: false })
    )
  })

  it('uses the requested OpenAI voice or defaults to alloy', async () => {
    resolveProvider.mockReturnValue('openai')
    synthesizeOpenAI.mockResolvedValue(makeStream())

    await POST(
      createRequest({ text: 'hello', provider: 'openai', voiceId: 'nova' })
    )
    await POST(createRequest({ text: 'hello', provider: 'openai' }))

    expect(synthesizeOpenAI).toHaveBeenNthCalledWith(
      1,
      'hello',
      'nova',
      expect.objectContaining({ aborted: false })
    )
    expect(synthesizeOpenAI).toHaveBeenNthCalledWith(
      2,
      'hello',
      'alloy',
      expect.objectContaining({ aborted: false })
    )
  })

  it('labels the fallback provider when ElevenLabs synthesis fails', async () => {
    resolveProvider.mockReturnValueOnce('elevenlabs')
    synthesizeElevenLabs.mockRejectedValueOnce(
      new Error('ElevenLabs unavailable')
    )
    synthesizeOpenAI.mockResolvedValueOnce(makeStream())

    const response = await POST(
      createRequest({
        text: 'hello world',
        provider: 'elevenlabs'
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-tts-provider')).toBe('openai')
    expect(response.headers.get('x-tts-notice')).toBe('provider-fallback')
    expect(response.headers.get('x-tts-notice-message')).toBe(
      'Voice fallback: switched to OpenAI.'
    )
    expect(synthesizeOpenAI).toHaveBeenCalledWith(
      'hello world',
      'alloy',
      expect.objectContaining({ aborted: false })
    )
  })

  it('returns 500 when ElevenLabs fails and OpenAI fallback is unavailable', async () => {
    resolveProvider.mockReturnValueOnce('elevenlabs')
    synthesizeElevenLabs.mockRejectedValueOnce(
      new Error('ElevenLabs unavailable')
    )
    delete process.env.OPENAI_API_KEY

    const response = await POST(
      createRequest({
        text: 'hello world',
        provider: 'elevenlabs'
      })
    )

    expect(response.status).toBe(500)
    await expect(readJson(response)).resolves.toEqual({
      error: 'TTS_ERROR',
      message: 'Speech synthesis failed: ElevenLabs unavailable'
    })
  })

  it('returns 500 when both providers fail during fallback', async () => {
    resolveProvider.mockReturnValueOnce('elevenlabs')
    synthesizeElevenLabs.mockRejectedValueOnce(
      new Error('ElevenLabs unavailable')
    )
    synthesizeOpenAI.mockRejectedValueOnce(new Error('OpenAI unavailable'))

    const response = await POST(
      createRequest({
        text: 'hello world',
        provider: 'elevenlabs'
      })
    )

    expect(response.status).toBe(500)
    await expect(readJson(response)).resolves.toEqual({
      error: 'TTS_ERROR',
      message: 'Speech synthesis failed: OpenAI unavailable'
    })
  })

  it('returns 504 when provider synthesis times out', async () => {
    vi.useFakeTimers()
    resolveProvider.mockReturnValueOnce('openai')
    synthesizeOpenAI.mockImplementationOnce(
      (_text: string, _voice: string, signal?: AbortSignal) =>
        signal
          ? new Promise((_resolve, reject) => {
              signal.addEventListener('abort', () => {
                reject(
                  Object.assign(new Error('aborted'), { name: 'AbortError' })
                )
              })
            })
          : Promise.reject(new Error('missing abort signal'))
    )

    const responsePromise = POST(
      createRequest({
        text: 'hello world',
        provider: 'openai'
      })
    )

    await vi.advanceTimersByTimeAsync(60)
    const response = await responsePromise

    expect(response.status).toBe(504)
    await expect(readJson(response)).resolves.toEqual({
      error: 'TTS_TIMEOUT',
      message: 'Speech synthesis timed out'
    })
    vi.useRealTimers()
  })

  it('returns 504 when ElevenLabs fails and OpenAI fallback times out', async () => {
    vi.useFakeTimers()
    resolveProvider.mockReturnValueOnce('elevenlabs')
    synthesizeElevenLabs.mockRejectedValueOnce(
      new Error('ElevenLabs unavailable')
    )
    synthesizeOpenAI.mockImplementationOnce(
      (_text: string, _voice: string, signal?: AbortSignal) =>
        signal
          ? new Promise((_resolve, reject) => {
              signal.addEventListener('abort', () => {
                reject(
                  Object.assign(new Error('aborted'), { name: 'AbortError' })
                )
              })
            })
          : Promise.reject(new Error('missing abort signal'))
    )

    const responsePromise = POST(
      createRequest({
        text: 'hello world',
        provider: 'elevenlabs'
      })
    )

    await vi.advanceTimersByTimeAsync(60)
    const response = await responsePromise

    expect(response.status).toBe(504)
    await expect(readJson(response)).resolves.toEqual({
      error: 'TTS_TIMEOUT',
      message: 'Speech synthesis timed out'
    })
    vi.useRealTimers()
  })
})
