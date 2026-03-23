'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { UIMessage } from '@/lib/types/ai'
import type { VoiceConfig, VoiceState } from '@/lib/voice/config'
import { DEFAULT_VOICE_CONFIG } from '@/lib/voice/config'
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

  const voiceActiveRef = useRef(false)
  const lastSpokenMessageIdRef = useRef<string | null>(null)
  const prevStatusRef = useRef(status)
  const prevPlaybackStateRef = useRef<'idle' | 'loading' | 'playing'>('idle')
  const stopListeningRef = useRef<() => void>(() => {})

  const resolvedProvider = useCallback(() => {
    if (config.ttsProvider === 'elevenlabs' && isQuotaExhausted()) {
      return 'browser' as const
    }
    return config.ttsProvider
  }, [config.ttsProvider])

  const {
    play,
    stop: stopAudio,
    isPlaying,
    playbackState,
    audioElement
  } = useVoicePlayer()

  const onTranscript = useCallback(
    (transcript: string) => {
      if (!voiceActiveRef.current || !transcript.trim()) return

      // Pause recognition while the LLM processes and TTS plays.
      // The "back to listening" effect restarts it after TTS finishes.
      stopListeningRef.current()
      setVoiceState('waiting')
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
    mediaStream
  } = useVoiceInput({ onTranscript })

  // Keep ref in sync so onTranscript can call it without circular deps
  stopListeningRef.current = stopListening

  const startVoice = useCallback(() => {
    if (!isSupported) return
    voiceActiveRef.current = true
    setIsVoiceActive(true)
    setVoiceState('listening')
    startListening()
  }, [isSupported, startListening])

  const stopVoice = useCallback(() => {
    voiceActiveRef.current = false
    setIsVoiceActive(false)
    setVoiceState('idle')
    stopListening()
    stopAudio()
    lastSpokenMessageIdRef.current = null
  }, [stopListening, stopAudio])

  // Transition: when chat status goes from streaming → ready, synthesize response
  useEffect(() => {
    const wasStreaming =
      prevStatusRef.current === 'streaming' ||
      prevStatusRef.current === 'submitted'
    const isReady = status === 'ready'
    prevStatusRef.current = status

    if (!voiceActiveRef.current || !wasStreaming || !isReady) return

    // Find the last assistant message
    const lastAssistant = messages.findLast(m => m.role === 'assistant')
    if (!lastAssistant) return
    if (lastAssistant.id === lastSpokenMessageIdRef.current) return

    // Extract text from the assistant message parts
    const text = lastAssistant.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join(' ')

    if (!text?.trim()) {
      console.warn(
        '[voice] No text found in assistant parts:',
        lastAssistant.parts?.map(p => p.type)
      )
      return
    }

    lastSpokenMessageIdRef.current = lastAssistant.id
    setVoiceState('speaking')
    const provider = resolvedProvider()
    console.debug(`[voice] Synthesizing ${text.length} chars via ${provider}`)
    play(text, provider)
  }, [status, messages, play, resolvedProvider])

  // Transition: when audio finishes playing, go back to listening.
  // Track the playback state transition (playing/loading → idle) to avoid
  // prematurely returning to listening before audio has started.
  useEffect(() => {
    const wasActive =
      prevPlaybackStateRef.current === 'playing' ||
      prevPlaybackStateRef.current === 'loading'
    prevPlaybackStateRef.current = playbackState

    if (
      voiceActiveRef.current &&
      voiceState === 'speaking' &&
      wasActive &&
      playbackState === 'idle'
    ) {
      setVoiceState('listening')
      startListening()
    }
  }, [playbackState, voiceState, startListening])

  // Transition: when status becomes submitted/streaming, show waiting
  useEffect(() => {
    if (
      voiceActiveRef.current &&
      (status === 'submitted' || status === 'streaming')
    ) {
      setVoiceState('waiting')
    }
  }, [status])

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

  return {
    voiceState,
    isVoiceActive,
    startVoice,
    stopVoice,
    config,
    updateConfig,
    interimTranscript: interimTranscript ?? '',
    mediaStream,
    audioElement
  }
}
