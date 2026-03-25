import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addUsage } from '@/lib/voice/usage'

vi.mock('@/lib/voice/config', () => ({
  TTS_MAX_CHARS: 2000,
  VOICE_CLIENT_TIMEOUT_MS: 25
}))

vi.mock('@/lib/voice/usage', () => ({
  addUsage: vi.fn()
}))

let useVoicePlayer: typeof import('./use-voice-player').useVoicePlayer

const createObjectURL = vi.fn(() => 'blob:tts-audio')
const revokeObjectURL = vi.fn()
const mockPlay = vi.fn().mockResolvedValue(undefined)

class MockAudio {
  onended: (() => void) | null = null
  onerror: ((event?: Event) => void) | null = null

  constructor(public src?: string) {}

  play = mockPlay
  pause = vi.fn()
  removeAttribute = vi.fn()
}

class MockSpeechSynthesisUtterance {
  onend: (() => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null

  constructor(public text: string) {}
}

describe('useVoicePlayer', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('MediaSource', undefined)
    vi.stubGlobal('Audio', MockAudio)
    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance)
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('audio-bytes', {
          headers: {
            'Content-Type': 'audio/mpeg',
            'x-tts-provider': 'openai',
            'x-tts-notice': 'provider-fallback',
            'x-tts-notice-message': 'Voice fallback: switched to OpenAI.'
          }
        })
      )
    )
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: vi.fn()
      }
    })
    ;({ useVoicePlayer } = await import('./use-voice-player'))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('does not record ElevenLabs usage when the server falls back to OpenAI', async () => {
    const { result } = renderHook(() => useVoicePlayer())

    await act(async () => {
      result.current.play('hello world', {
        provider: 'elevenlabs',
        voiceId: 'voice-123'
      })
    })

    await waitFor(() => {
      expect(mockPlay).toHaveBeenCalled()
    })

    expect(addUsage).not.toHaveBeenCalled()
    expect(result.current.lastServedProvider).toBe('openai')
    expect(result.current.lastNotice).toEqual({
      code: 'provider-fallback',
      message: 'Voice fallback: switched to OpenAI.'
    })
  })

  it('reports a timeout when synthesis exceeds the client deadline', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((_input, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          })
        })
      })
    )

    const { result } = renderHook(() => useVoicePlayer())

    await act(async () => {
      result.current.play('slow request', {
        provider: 'openai',
        voiceId: 'alloy'
      })
      await vi.advanceTimersByTimeAsync(30)
      await Promise.resolve()
    })

    expect(result.current.playbackState).toBe('idle')
    expect(result.current.lastError).toEqual({
      code: 'tts-timeout',
      message: 'Voice synthesis timed out. Please try again.'
    })

    vi.useRealTimers()
  })

  it('captures playback failures from audio.play()', async () => {
    mockPlay.mockRejectedValueOnce(new Error('Autoplay blocked'))
    const { result } = renderHook(() => useVoicePlayer())

    await act(async () => {
      result.current.play('hello world', {
        provider: 'openai',
        voiceId: 'alloy'
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.playbackState).toBe('idle')
    expect(result.current.lastError).toEqual({
      code: 'tts-playback-failed',
      message: 'Autoplay blocked'
    })
  })

  it('captures browser speech synthesis error details', async () => {
    const speak = vi.fn((utterance: MockSpeechSynthesisUtterance) => {
      utterance.onerror?.({ error: 'synthesis-unavailable' })
    })

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak
      }
    })

    const { result } = renderHook(() => useVoicePlayer())

    await act(async () => {
      result.current.play('hello world', {
        provider: 'browser',
        voiceId: 'browser'
      })
      await Promise.resolve()
    })

    expect(result.current.lastError).toEqual({
      code: 'browser-tts-error',
      message: 'Browser speech synthesis failed: synthesis-unavailable'
    })
    expect(result.current.playbackState).toBe('idle')
  })

  it('second play() supersedes the first — aborted request AbortError is silenced', async () => {
    // Request A: rejects with AbortError when its signal fires (real fetch behaviour)
    // Request B: resolves successfully
    // Proves the isCurrentRequest() guard in the catch block prevents request A's
    // AbortError from setting lastError or resetting request B's state.
    let requestCount = 0
    const fetchMock = vi.fn((_input: unknown, init?: RequestInit) => {
      requestCount++
      const signal = init?.signal as AbortSignal
      if (requestCount === 1) {
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          })
        })
      }
      return Promise.resolve(
        new Response('audio-bytes-2', {
          headers: { 'Content-Type': 'audio/mpeg', 'x-tts-provider': 'openai' }
        })
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useVoicePlayer())

    await act(async () => {
      result.current.play('first', { provider: 'openai', voiceId: 'alloy' })
      result.current.play('second', { provider: 'openai', voiceId: 'alloy' })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.playbackState).toBe('playing')
    })

    expect(result.current.lastError).toBeNull()
    expect(mockPlay).toHaveBeenCalledTimes(1)
  })

  it('stop() during in-flight request leaves no error', async () => {
    // Fetch rejects with AbortError when the signal fires — mirrors real fetch behaviour.
    // Proves the isCurrentRequest() guard in the catch block fires and returns early,
    // keeping lastError null even though an AbortError propagated through the catch path.
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: unknown, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          })
        })
      })
    )

    const { result } = renderHook(() => useVoicePlayer())

    await act(async () => {
      result.current.play('first', { provider: 'openai', voiceId: 'alloy' })
    })

    expect(result.current.playbackState).toBe('loading')

    await act(async () => {
      result.current.stop()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.playbackState).toBe('idle')
    expect(result.current.lastError).toBeNull()
  })
})
