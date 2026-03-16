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

  const resolvedProvider = useCallback(() => {
    if (config.ttsProvider === 'elevenlabs' && isQuotaExhausted()) {
      return 'browser' as const
    }
    return config.ttsProvider
  }, [config.ttsProvider])

  const { play, stop: stopAudio, isPlaying } = useVoicePlayer()

  const onTranscript = useCallback(
    (transcript: string) => {
      if (!voiceActiveRef.current || !transcript.trim()) return

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
    interimTranscript
  } = useVoiceInput({ onTranscript })

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
    const lastAssistant = [...messages]
      .reverse()
      .find(m => m.role === 'assistant')
    if (!lastAssistant) return
    if (lastAssistant.id === lastSpokenMessageIdRef.current) return

    // Extract text from the assistant message parts
    const text = lastAssistant.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join(' ')

    if (!text?.trim()) return

    lastSpokenMessageIdRef.current = lastAssistant.id
    setVoiceState('speaking')
    play(text, resolvedProvider())
  }, [status, messages, play, resolvedProvider])

  // Transition: when audio finishes playing, go back to listening
  useEffect(() => {
    if (voiceActiveRef.current && voiceState === 'speaking' && !isPlaying) {
      setVoiceState('listening')
      startListening()
    }
  }, [isPlaying, voiceState, startListening])

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
    updateConfig
  }
}
