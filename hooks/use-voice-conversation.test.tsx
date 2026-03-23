import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

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
  isQuotaExhausted: () => false
}))

vi.mock('./use-voice-input', () => ({
  useVoiceInput: () => ({
    isListening: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    isSupported: true,
    interimTranscript: '',
    mediaStream: null
  })
}))

const mockPlay = vi.fn()
const mockStop = vi.fn()

vi.mock('./use-voice-player', () => ({
  useVoicePlayer: () => ({
    play: mockPlay,
    stop: mockStop,
    playbackState: 'idle',
    isPlaying: false,
    audioElement: null
  })
}))

import { useVoiceConversation } from './use-voice-conversation'

function makeAssistantMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text }]
  } as UIMessage
}

describe('useVoiceConversation — debounced TTS trigger', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers TTS when text stabilizes during streaming (before status=ready)', () => {
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

    // Activate voice mode
    act(() => {
      result.current.startVoice()
    })

    // Simulate streaming with growing text
    const msg = makeAssistantMessage('msg-1', 'Hello')
    rerender({
      sendMessage,
      status: 'streaming',
      messages: [msg],
      config: { ttsProvider: 'browser' as const }
    })

    // Text grows
    const msg2 = makeAssistantMessage('msg-1', 'Hello world')
    rerender({
      sendMessage,
      status: 'streaming',
      messages: [msg2],
      config: { ttsProvider: 'browser' as const }
    })

    // Not yet — debounce hasn't expired
    expect(mockPlay).not.toHaveBeenCalled()

    // Text stabilizes — advance past debounce
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(mockPlay).toHaveBeenCalledWith('Hello world', 'browser')
  })

  it('does not double-fire when status becomes ready after debounce already triggered', () => {
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

    // Streaming with text
    rerender({
      sendMessage,
      status: 'streaming',
      messages: [msg],
      config: { ttsProvider: 'browser' as const }
    })

    // Debounce fires
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(mockPlay).toHaveBeenCalledTimes(1)

    // Now status goes to ready — should NOT re-trigger
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

    // Status goes through streaming briefly then ready
    rerender({
      sendMessage,
      status: 'streaming',
      messages: [msg],
      config: { ttsProvider: 'browser' as const }
    })

    // Status immediately becomes ready (short response)
    rerender({
      sendMessage,
      status: 'ready',
      messages: [msg],
      config: { ttsProvider: 'browser' as const }
    })

    // Should fire immediately without needing debounce timer
    expect(mockPlay).toHaveBeenCalledWith('Quick response', 'browser')
  })
})
