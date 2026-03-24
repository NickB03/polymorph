import { act, renderHook, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi
} from 'vitest'

import { useVoiceInput } from '@/hooks/use-voice-input'

class MockSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe('useVoiceInput', () => {
  const recognitionInstances: MockSpeechRecognition[] = []
  const getUserMedia = vi.fn()

  beforeEach(() => {
    recognitionInstances.length = 0
    vi.clearAllMocks()

    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: vi.fn(() => {
        const instance = new MockSpeechRecognition()
        recognitionInstances.push(instance)
        return instance
      })
    })

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes async startListening in the public hook contract', () => {
    const { result } = renderHook(() => useVoiceInput())

    expectTypeOf(result.current.startListening).toEqualTypeOf<
      () => Promise<void>
    >()
  })

  it('does not start recognition if stopped while waiting for mic access', async () => {
    const streamDeferred = deferred<MediaStream>()
    getUserMedia.mockReturnValueOnce(streamDeferred.promise)

    const { result } = renderHook(() => useVoiceInput())

    act(() => {
      void result.current.startListening()
      result.current.stopListening()
    })

    const stoppedTracks: { stop: ReturnType<typeof vi.fn> }[] = []
    const mediaStream = {
      getTracks: () => stoppedTracks
    } as unknown as MediaStream

    stoppedTracks.push({ stop: vi.fn() })
    streamDeferred.resolve(mediaStream)

    await waitFor(() => {
      expect(recognitionInstances).toHaveLength(0)
      expect(result.current.mediaStream).toBeNull()
      expect(result.current.isListening).toBe(false)
      expect(stoppedTracks[0].stop).toHaveBeenCalledTimes(1)
    })
  })

  it.each(['onend', 'onerror'] as const)(
    'clears the visualization stream when recognition %s fires',
    async handler => {
      const stream = {
        getTracks: () => [{ stop: vi.fn() }]
      } as unknown as MediaStream
      getUserMedia.mockResolvedValueOnce(stream)

      const { result } = renderHook(() => useVoiceInput())

      await act(async () => {
        await result.current.startListening()
      })

      const recognition = recognitionInstances[0]
      expect(recognition).toBeDefined()

      await act(async () => {
        if (handler === 'onend') {
          recognition.onend?.()
        } else {
          recognition.onerror?.({ error: 'network' })
        }
      })

      await waitFor(() => {
        expect(result.current.mediaStream).toBeNull()
        expect(result.current.isListening).toBe(false)
      })
    }
  )
})
