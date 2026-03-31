import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

const { mockUseVoiceInput, mockUseVoicePlayer, isQuotaExhausted } = vi.hoisted(
  () => ({
    mockUseVoiceInput: vi.fn(),
    mockUseVoicePlayer: vi.fn(),
    isQuotaExhausted: vi.fn(() => false)
  })
)

vi.mock('@/lib/voice/config', () => ({
  DEFAULT_VOICE_CONFIG: {
    ttsProvider: 'browser',
    voiceId: 'test',
    speechRate: 1,
    autoListen: true
  },
  TTS_TEXT_DEBOUNCE_MS: 200,
  isVoiceEnabled: () => true
}))

vi.mock('@/lib/voice/usage', () => ({
  isQuotaExhausted
}))

vi.mock('./use-voice-input', () => ({
  useVoiceInput: (...args: unknown[]) => mockUseVoiceInput(...args)
}))

vi.mock('./use-voice-player', () => ({
  useVoicePlayer: () => mockUseVoicePlayer()
}))

import { useVoiceConversation } from './use-voice-conversation'

function makeAssistantMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text }]
  } as UIMessage
}

describe('useVoiceConversation', () => {
  let mockStartListening: ReturnType<typeof vi.fn>
  let mockStopListening: ReturnType<typeof vi.fn>
  let mockPlay: ReturnType<typeof vi.fn>
  let mockStopAudio: ReturnType<typeof vi.fn>
  let voiceInputState: Record<string, unknown>
  let voicePlayerState: Record<string, unknown>

  beforeEach(() => {
    vi.clearAllMocks()

    mockStartListening = vi.fn().mockResolvedValue(undefined)
    mockStopListening = vi.fn()
    mockPlay = vi.fn()
    mockStopAudio = vi.fn()

    voiceInputState = {
      isListening: false,
      startListening: mockStartListening,
      stopListening: mockStopListening,
      isSupported: true,
      interimTranscript: '',
      mediaStream: null,
      lastError: null
    }

    voicePlayerState = {
      play: mockPlay,
      stop: mockStopAudio,
      playbackState: 'idle',
      isPlaying: false,
      audioElement: null,
      lastError: null,
      lastServedProvider: null,
      lastNotice: null
    }

    mockUseVoiceInput.mockImplementation(() => voiceInputState)
    mockUseVoicePlayer.mockImplementation(() => voicePlayerState)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers TTS when text stabilizes during streaming (before status=ready)', () => {
    vi.useFakeTimers()
    const sendMessage = vi.fn()
    const messages: UIMessage[] = []

    const { result, rerender } = renderHook(
      props => useVoiceConversation(props),
      {
        initialProps: {
          sendMessage,
          status: 'ready' as string,
          messages,
          config: { ttsProvider: 'browser' as const }
        }
      }
    )

    act(() => {
      result.current.startVoice()
    })

    const msg = makeAssistantMessage('msg-1', 'Hello')
    rerender({
      sendMessage,
      status: 'streaming',
      messages: [msg],
      config: { ttsProvider: 'browser' as const }
    })

    const msg2 = makeAssistantMessage('msg-1', 'Hello world')
    rerender({
      sendMessage,
      status: 'streaming',
      messages: [msg2],
      config: { ttsProvider: 'browser' as const }
    })

    expect(mockPlay).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(mockPlay).toHaveBeenCalledWith('Hello world', {
      provider: 'browser',
      voiceId: 'test'
    })
  })

  it('does not double-fire when status becomes ready after debounce already triggered', () => {
    vi.useFakeTimers()
    const sendMessage = vi.fn()
    const msg = makeAssistantMessage('msg-1', 'Response text')

    const { result, rerender } = renderHook(
      props => useVoiceConversation(props),
      {
        initialProps: {
          sendMessage,
          status: 'ready' as string,
          messages: [] as UIMessage[],
          config: { ttsProvider: 'browser' as const }
        }
      }
    )

    act(() => {
      result.current.startVoice()
    })

    rerender({
      sendMessage,
      status: 'streaming',
      messages: [msg],
      config: { ttsProvider: 'browser' as const }
    })

    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(mockPlay).toHaveBeenCalledTimes(1)

    rerender({
      sendMessage,
      status: 'ready',
      messages: [msg],
      config: { ttsProvider: 'browser' as const }
    })

    expect(mockPlay).toHaveBeenCalledTimes(1)
  })

  it('fires immediately when status=ready without debounce', () => {
    const sendMessage = vi.fn()
    const msg = makeAssistantMessage('msg-1', 'Quick response')

    const { result, rerender } = renderHook(
      props => useVoiceConversation(props),
      {
        initialProps: {
          sendMessage,
          status: 'ready' as string,
          messages: [] as UIMessage[],
          config: { ttsProvider: 'browser' as const }
        }
      }
    )

    act(() => {
      result.current.startVoice()
    })

    rerender({
      sendMessage,
      status: 'streaming',
      messages: [msg],
      config: { ttsProvider: 'browser' as const }
    })

    rerender({
      sendMessage,
      status: 'ready',
      messages: [msg],
      config: { ttsProvider: 'browser' as const }
    })

    expect(mockPlay).toHaveBeenCalledWith('Quick response', {
      provider: 'browser',
      voiceId: 'test'
    })
  })

  it('returns to idle when chat status becomes error', async () => {
    const sendMessage = vi.fn()

    const { result, rerender } = renderHook(
      props => useVoiceConversation(props),
      {
        initialProps: {
          sendMessage,
          status: 'ready' as string,
          messages: [] as UIMessage[],
          config: { ttsProvider: 'browser' as const }
        }
      }
    )

    act(() => {
      result.current.startVoice()
    })

    rerender({
      sendMessage,
      status: 'streaming',
      messages: [makeAssistantMessage('msg-1', 'Hello world')],
      config: { ttsProvider: 'browser' as const }
    })

    rerender({
      sendMessage,
      status: 'error',
      messages: [makeAssistantMessage('msg-1', 'Hello world')],
      config: { ttsProvider: 'browser' as const }
    })

    expect(result.current.voiceState).toBe('idle')
    expect(result.current.isVoiceActive).toBe(false)
    expect(mockStopAudio).toHaveBeenCalled()
    expect(mockStopListening).toHaveBeenCalled()
    expect(result.current.voiceError).toEqual({
      code: 'chat-response-failed',
      message: 'Voice mode stopped because the chat response failed.'
    })
  })

  it('does not restart listening after playback if autoListen is disabled', async () => {
    const sendMessage = vi.fn()
    const { result, rerender } = renderHook(
      props => useVoiceConversation(props),
      {
        initialProps: {
          sendMessage,
          status: 'ready' as string,
          messages: [] as UIMessage[],
          config: { ttsProvider: 'browser' as const, autoListen: false }
        }
      }
    )

    act(() => {
      result.current.startVoice()
    })

    voicePlayerState = {
      ...voicePlayerState,
      playbackState: 'playing'
    }

    rerender({
      sendMessage,
      status: 'ready',
      messages: [makeAssistantMessage('msg-1', 'Done')],
      config: { ttsProvider: 'browser' as const, autoListen: false }
    })

    voicePlayerState = {
      ...voicePlayerState,
      playbackState: 'idle'
    }

    rerender({
      sendMessage,
      status: 'ready',
      messages: [makeAssistantMessage('msg-1', 'Done')],
      config: { ttsProvider: 'browser' as const, autoListen: false }
    })

    expect(mockStartListening).toHaveBeenCalledTimes(1)
    expect(result.current.voiceState).toBe('idle')
    expect(result.current.isVoiceActive).toBe(false)
  })

  it('only restarts listening once when playback errors (no duplicate restart)', async () => {
    const sendMessage = vi.fn()
    const { result, rerender } = renderHook(
      props => useVoiceConversation(props),
      {
        initialProps: {
          sendMessage,
          status: 'ready' as string,
          messages: [] as UIMessage[],
          config: { ttsProvider: 'browser' as const, autoListen: true }
        }
      }
    )

    // 1. Start voice — startListening call #1
    act(() => {
      result.current.startVoice()
    })

    // 2. Transition to playing — voiceState becomes 'speaking'
    voicePlayerState = {
      ...voicePlayerState,
      playbackState: 'playing',
      lastError: null
    }
    rerender({
      sendMessage,
      status: 'ready',
      messages: [],
      config: { ttsProvider: 'browser' as const, autoListen: true }
    })

    await waitFor(() => {
      expect(result.current.voiceState).toBe('speaking')
    })

    // 3. Playback errors: both playbackState→idle AND lastError set simultaneously
    voicePlayerState = {
      ...voicePlayerState,
      playbackState: 'idle',
      lastError: { code: 'tts-audio-error', message: 'Voice playback failed' }
    }
    rerender({
      sendMessage,
      status: 'ready',
      messages: [],
      config: { ttsProvider: 'browser' as const, autoListen: true }
    })

    // Should be exactly 2: one from startVoice(), one from error recovery
    // (NOT 3 — the playback-finished effect must not duplicate the restart)
    await waitFor(() => {
      expect(mockStartListening).toHaveBeenCalledTimes(2)
    })
  })

  it('does not restart listening on playerError when inputError already shut down voice', async () => {
    const sendMessage = vi.fn()
    const { result, rerender } = renderHook(
      props => useVoiceConversation(props),
      {
        initialProps: {
          sendMessage,
          status: 'ready' as string,
          messages: [] as UIMessage[],
          config: { ttsProvider: 'browser' as const, autoListen: true }
        }
      }
    )

    act(() => {
      result.current.startVoice()
    })

    // Simulate both errors arriving simultaneously
    voiceInputState = {
      ...voiceInputState,
      lastError: {
        code: 'speech-recognition-error',
        message: 'Speech recognition failed'
      }
    }
    voicePlayerState = {
      ...voicePlayerState,
      lastError: {
        code: 'tts-playback-failed',
        message: 'Playback failed'
      }
    }

    rerender({
      sendMessage,
      status: 'ready',
      messages: [],
      config: { ttsProvider: 'browser' as const, autoListen: true }
    })

    // inputError should shut down voice — playerError should NOT restart listening
    expect(result.current.voiceState).toBe('idle')
    expect(result.current.isVoiceActive).toBe(false)
    // startListening called only once (from startVoice), not again from playerError
    expect(mockStartListening).toHaveBeenCalledTimes(1)
  })

  it('aggregates voice player notices and errors', async () => {
    const sendMessage = vi.fn()
    voicePlayerState = {
      ...voicePlayerState,
      lastError: {
        code: 'tts-playback-failed',
        message: 'Autoplay blocked'
      },
      lastNotice: {
        code: 'provider-fallback',
        message: 'Voice fallback: switched to OpenAI.'
      }
    }

    const { result } = renderHook(() =>
      useVoiceConversation({
        sendMessage,
        status: 'ready',
        messages: [],
        config: { ttsProvider: 'elevenlabs' }
      })
    )

    expect(result.current.voiceError).toEqual({
      code: 'tts-playback-failed',
      message: 'Autoplay blocked'
    })
    expect(result.current.voiceNotice).toEqual({
      code: 'provider-fallback',
      message: 'Voice fallback: switched to OpenAI.'
    })
  })
})
