import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addUsage } from '@/lib/voice/usage'

vi.mock('@/lib/voice/usage', () => ({
  addUsage: vi.fn()
}))

let useVoicePlayer: typeof import('./use-voice-player').useVoicePlayer

const createObjectURL = vi.fn(() => 'blob:tts-audio')
const revokeObjectURL = vi.fn()
const mockPlay = vi.fn().mockResolvedValue(undefined)

class MockAudio {
  onended: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(public src?: string) {}

  play = mockPlay
  pause = vi.fn()
  removeAttribute = vi.fn()
}

describe('useVoicePlayer', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('MediaSource', undefined)
    vi.stubGlobal('Audio', MockAudio)
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('audio-bytes', {
          headers: {
            'Content-Type': 'audio/mpeg',
            'x-tts-provider': 'openai'
          }
        })
      )
    )
    ;({ useVoicePlayer } = await import('./use-voice-player'))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('does not record ElevenLabs usage when the server falls back to OpenAI', async () => {
    const { result } = renderHook(() => useVoicePlayer())

    await act(async () => {
      result.current.play('hello world', 'elevenlabs')
    })

    await waitFor(() => {
      expect(mockPlay).toHaveBeenCalled()
    })

    expect(addUsage).not.toHaveBeenCalled()
  })
})
