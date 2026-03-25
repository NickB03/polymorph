'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { UIMessage } from '@/lib/types/ai'
import type {
  VoiceConfig,
  VoiceError,
  VoiceNotice,
  VoiceState
} from '@/lib/voice/config'
import { DEFAULT_VOICE_CONFIG, TTS_TEXT_DEBOUNCE_MS } from '@/lib/voice/config'
import { isQuotaExhausted } from '@/lib/voice/usage'

import { useVoiceInput } from './use-voice-input'
import { useVoicePlayer } from './use-voice-player'

type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error'

interface UseVoiceConversationOptions {
  sendMessage: (message: {
    role: 'user'
    parts: { type: 'text'; text: string }[]
  }) => void
  status: ChatStatus | string
  messages: UIMessage[]
  config?: Partial<VoiceConfig>
}

interface UseVoiceConversationReturn {
  voiceState: VoiceState
  isVoiceActive: boolean
  startVoice: () => void
  stopVoice: () => void
  config: VoiceConfig
  updateConfig: (updates: Partial<VoiceConfig>) => void
  interimTranscript: string
  /** Raw mic MediaStream for visualization */
  mediaStream: MediaStream | null
  /** TTS HTMLAudioElement for visualization */
  audioElement: HTMLAudioElement | null
  voiceError: VoiceError | null
  voiceNotice: VoiceNotice | null
}

/**
 * Orchestration hook composing voice input + voice player into a
 * continuous conversation loop.
 *
 * State machine:
 *   idle → listening → waiting → speaking → listening
 *   Any state → idle (on stop)
 *   speaking → listening (interrupt: user speaks during playback)
 */
export function useVoiceConversation({
  sendMessage,
  status,
  messages,
  config: configOverrides
}: UseVoiceConversationOptions): UseVoiceConversationReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [config, setConfig] = useState<VoiceConfig>({
    ...DEFAULT_VOICE_CONFIG,
    ...configOverrides
  })
  const [conversationError, setConversationError] = useState<VoiceError | null>(
    null
  )

  const voiceActiveRef = useRef(false)
  const lastSpokenMessageIdRef = useRef<string | null>(null)
  const prevPlaybackStateRef = useRef<'idle' | 'loading' | 'playing'>('idle')
  const stopListeningRef = useRef<() => void>(() => {})
  const lastTextRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resolvedProvider = useCallback(() => {
    if (config.ttsProvider === 'elevenlabs' && isQuotaExhausted()) {
      return 'browser' as const
    }
    return config.ttsProvider
  }, [config.ttsProvider])

  const {
    play,
    stop: stopAudio,
    playbackState,
    audioElement,
    lastError: playerError,
    lastNotice: playerNotice
  } = useVoicePlayer()

  const onTranscript = useCallback(
    (transcript: string) => {
      if (!voiceActiveRef.current || !transcript.trim()) return

      // Pause recognition while the LLM processes and TTS plays.
      // The "back to listening" effect restarts it after TTS finishes.
      stopListeningRef.current()
      setVoiceState('waiting')
      setConversationError(null)
      sendMessage({
        role: 'user',
        parts: [{ type: 'text', text: transcript }]
      })
    },
    [sendMessage]
  )

  const {
    isListening,
    startListening,
    stopListening,
    isSupported,
    interimTranscript,
    mediaStream,
    lastError: inputError
  } = useVoiceInput({ onTranscript })

  // Keep ref in sync so onTranscript can call it without circular deps
  stopListeningRef.current = stopListening

  const startVoice = useCallback(() => {
    if (!isSupported) return
    setConversationError(null)
    voiceActiveRef.current = true
    setIsVoiceActive(true)
    setVoiceState('listening')
    void startListening()
  }, [isSupported, startListening])

  const stopVoice = useCallback(() => {
    voiceActiveRef.current = false
    setIsVoiceActive(false)
    setVoiceState('idle')
    stopListening()
    stopAudio()
    setConversationError(null)
    lastSpokenMessageIdRef.current = null
    lastTextRef.current = null
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [stopListening, stopAudio])

  // Extract text from the last assistant message for TTS
  const lastAssistant = messages.findLast(m => m.role === 'assistant')
  const assistantText =
    lastAssistant?.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join(' ')
      ?.trim() || null

  // Trigger TTS when assistant text stabilizes (debounced).
  // Fires during streaming — no need to wait for status=ready.
  useEffect(() => {
    if (!voiceActiveRef.current) return
    if (!assistantText) return
    if (lastAssistant && lastAssistant.id === lastSpokenMessageIdRef.current)
      return

    // Only trigger during active response (streaming or just finished)
    if (status !== 'streaming' && status !== 'ready') return

    // If status is ready, fire immediately (no debounce needed)
    if (status === 'ready') {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      lastSpokenMessageIdRef.current = lastAssistant!.id
      // Stay in 'waiting' — the playbackState effect below will
      // transition to 'speaking' once audio actually starts playing.
      const provider = resolvedProvider()
      console.debug(
        `[voice] Synthesizing ${assistantText.length} chars via ${provider} (ready)`
      )
      play(assistantText, { provider, voiceId: config.voiceId })
      return
    }

    // Streaming: debounce — wait for text to stop growing
    if (assistantText !== lastTextRef.current) {
      lastTextRef.current = assistantText

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        if (!voiceActiveRef.current) return
        if (lastAssistant!.id === lastSpokenMessageIdRef.current) return

        lastSpokenMessageIdRef.current = lastAssistant!.id
        const provider = resolvedProvider()
        console.debug(
          `[voice] Synthesizing ${assistantText.length} chars via ${provider} (debounced)`
        )
        play(assistantText, { provider, voiceId: config.voiceId })
      }, TTS_TEXT_DEBOUNCE_MS)
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [
    assistantText,
    config.voiceId,
    status,
    lastAssistant,
    play,
    resolvedProvider
  ])

  // Transition: when playback starts, show speaking state.
  // This replaces the old approach of setting 'speaking' immediately
  // when play() is called — now we wait for audio to actually play.
  useEffect(() => {
    if (voiceActiveRef.current && playbackState === 'playing') {
      setVoiceState('speaking')
    }
  }, [playbackState])

  // Transition: when audio finishes playing, go back to listening.
  // Track the playback state transition (playing/loading → idle) to avoid
  // prematurely returning to listening before audio has started.
  useEffect(() => {
    const wasActive =
      prevPlaybackStateRef.current === 'playing' ||
      prevPlaybackStateRef.current === 'loading'
    prevPlaybackStateRef.current = playbackState

    if (playerError) return // error recovery is handled by the playerError effect

    if (
      voiceActiveRef.current &&
      voiceState === 'speaking' &&
      wasActive &&
      playbackState === 'idle'
    ) {
      if (config.autoListen) {
        setVoiceState('listening')
        void startListening()
      } else {
        voiceActiveRef.current = false
        setIsVoiceActive(false)
        setVoiceState('idle')
      }
    }
  }, [
    config.autoListen,
    playerError,
    playbackState,
    voiceState,
    startListening
  ])

  // Transition: when status becomes submitted/streaming, show waiting
  useEffect(() => {
    if (
      voiceActiveRef.current &&
      (status === 'submitted' || status === 'streaming')
    ) {
      setVoiceState('waiting')
    }
  }, [status])

  useEffect(() => {
    if (!voiceActiveRef.current || status !== 'error') return

    voiceActiveRef.current = false
    setIsVoiceActive(false)
    setVoiceState('idle')
    stopListening()
    stopAudio()
    setConversationError({
      code: 'chat-response-failed',
      message: 'Voice mode stopped because the chat response failed.'
    })
  }, [status, stopAudio, stopListening])

  // Interrupt: if user starts speaking during playback, stop audio
  useEffect(() => {
    if (
      voiceActiveRef.current &&
      voiceState === 'speaking' &&
      (isListening || interimTranscript)
    ) {
      stopAudio()
      setVoiceState('listening')
    }
  }, [isListening, interimTranscript, voiceState, stopAudio])

  const updateConfig = useCallback((updates: Partial<VoiceConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }, [])

  useEffect(() => {
    if (!voiceActiveRef.current || !inputError) return

    voiceActiveRef.current = false
    setIsVoiceActive(false)
    setVoiceState('idle')
    setConversationError(inputError)
  }, [inputError])

  useEffect(() => {
    if (!voiceActiveRef.current || !playerError) return

    if (config.autoListen) {
      setVoiceState('listening')
      void startListening()
      return
    }

    voiceActiveRef.current = false
    setIsVoiceActive(false)
    setVoiceState('idle')
  }, [config.autoListen, playerError, startListening])

  const voiceError = conversationError ?? inputError ?? playerError
  const voiceNotice = playerNotice

  return {
    voiceState,
    isVoiceActive,
    startVoice,
    stopVoice,
    config,
    updateConfig,
    interimTranscript: interimTranscript ?? '',
    mediaStream,
    audioElement,
    voiceError,
    voiceNotice
  }
}
