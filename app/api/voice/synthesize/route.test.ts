import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('user-123')
}))

vi.mock('@/lib/utils/json-error', () => ({
  jsonError: vi.fn(
    (code: string, message: string, status: number) =>
      new Response(JSON.stringify({ error: code, message }), { status })
  )
}))

vi.mock('@/lib/voice/config', () => ({
  isVoiceEnabled: vi.fn().mockReturnValue(true),
  TTS_MAX_CHARS: 2000
}))

vi.mock('@/lib/voice/tts-provider', () => ({
  resolveProvider: vi.fn(),
  synthesizeElevenLabs: vi.fn(),
  synthesizeOpenAI: vi.fn()
}))

import {
  resolveProvider,
  synthesizeElevenLabs,
  synthesizeOpenAI
} from '@/lib/voice/tts-provider'

import { POST } from './route'

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/voice/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('POST /api/voice/synthesize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-openai-key'
  })

  it('labels the fallback provider when ElevenLabs synthesis fails', async () => {
    vi.mocked(resolveProvider).mockReturnValueOnce('elevenlabs')
    vi.mocked(synthesizeElevenLabs).mockRejectedValueOnce(
      new Error('ElevenLabs unavailable')
    )
    vi.mocked(synthesizeOpenAI).mockResolvedValueOnce(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        }
      })
    )

    const response = await POST(
      createRequest({
        text: 'hello world',
        provider: 'elevenlabs'
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-tts-provider')).toBe('openai')
    expect(synthesizeOpenAI).toHaveBeenCalledWith('hello world', 'alloy')
  })
})
