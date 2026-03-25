import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseVoicePlayer, mockToast, mockToastError } = vi.hoisted(() => ({
  mockUseVoicePlayer: vi.fn(),
  mockToast: vi.fn(),
  mockToastError: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: Object.assign(mockToast, {
    error: mockToastError
  })
}))

vi.mock('@/hooks/use-voice-player', () => ({
  useVoicePlayer: () => mockUseVoicePlayer()
}))

import { SpeakButton } from './speak-button'

describe('SpeakButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseVoicePlayer.mockReturnValue({
      play: vi.fn(),
      stop: vi.fn(),
      playbackState: 'idle',
      lastError: null,
      lastNotice: null
    })
  })

  it('shows a toast error when playback fails', async () => {
    mockUseVoicePlayer.mockReturnValue({
      play: vi.fn(),
      stop: vi.fn(),
      playbackState: 'idle',
      lastError: {
        code: 'tts-playback-failed',
        message: 'Autoplay blocked'
      },
      lastNotice: null
    })

    render(<SpeakButton text="Read this" />)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Autoplay blocked')
    })
  })

  it('shows a fallback toast when the provider changes', async () => {
    mockUseVoicePlayer.mockReturnValue({
      play: vi.fn(),
      stop: vi.fn(),
      playbackState: 'idle',
      lastError: null,
      lastNotice: {
        code: 'provider-fallback',
        message: 'Voice fallback: switched to OpenAI.'
      }
    })

    render(<SpeakButton text="Read this" />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        'Voice fallback: switched to OpenAI.'
      )
    })
  })
})
