import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAudioStream } from './use-audio-stream'

const connect = vi.fn()
const disconnect = vi.fn()
const close = vi.fn()
const resume = vi.fn()

const createMediaElementSource = vi.fn(() => ({
  connect,
  disconnect
}))

const createMediaStreamDestination = vi.fn(() => ({
  stream: { id: 'stream-1' }
}))

class MockAudioContext {
  state = 'running'
  destination = { id: 'destination' }

  createMediaElementSource = createMediaElementSource
  createMediaStreamDestination = createMediaStreamDestination
  close = close
  resume = resume
}

describe('useAudioStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('AudioContext', MockAudioContext)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reuses one AudioContext across audio element changes', () => {
    const firstAudio = {} as HTMLAudioElement
    const secondAudio = {} as HTMLAudioElement

    const { rerender, unmount } = renderHook(
      ({ audioElement }) => useAudioStream(audioElement),
      {
        initialProps: {
          audioElement: firstAudio
        }
      }
    )

    rerender({ audioElement: secondAudio })

    expect(createMediaElementSource).toHaveBeenCalledTimes(2)
    expect(createMediaStreamDestination).toHaveBeenCalledTimes(1)
    expect(close).not.toHaveBeenCalled()

    unmount()

    expect(close).toHaveBeenCalledTimes(1)
  })
})
