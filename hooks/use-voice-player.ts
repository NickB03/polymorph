'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { TTSProvider, VoiceError, VoiceNotice } from '@/lib/voice/config'
import { TTS_MAX_CHARS, VOICE_CLIENT_TIMEOUT_MS } from '@/lib/voice/config'
import { addUsage } from '@/lib/voice/usage'

type PlaybackState = 'idle' | 'loading' | 'playing'

interface PlayVoiceOptions {
  provider?: TTSProvider
  voiceId?: string
}

interface UseVoicePlayerReturn {
  play: (text: string, options?: PlayVoiceOptions) => void
  stop: () => void
  playbackState: PlaybackState
  isPlaying: boolean
  /** Current HTMLAudioElement for server TTS playback (null for browser TTS) */
  audioElement: HTMLAudioElement | null
  lastError: VoiceError | null
  lastServedProvider: TTSProvider | null
  lastNotice: VoiceNotice | null
}

/**
 * Manages TTS playback.
 *
 * For 'browser' provider, uses window.speechSynthesis directly (client-only).
 * For 'elevenlabs' / 'openai', fetches audio from /api/voice/synthesize.
 */
export function useVoicePlayer(): UseVoicePlayerReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle')
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  )
  const [lastError, setLastError] = useState<VoiceError | null>(null)
  const [lastServedProvider, setLastServedProvider] =
    useState<TTSProvider | null>(null)
  const [lastNotice, setLastNotice] = useState<VoiceNotice | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current = null
    }
    setAudioElement(null)
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    // Also stop browser speechSynthesis if active
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    cleanup()
    setPlaybackState('idle')
  }, [cleanup])

  const playBrowserTTS = useCallback(
    (text: string) => {
      cleanup()
      setLastError(null)
      setLastNotice(null)
      setLastServedProvider('browser')

      if (!window.speechSynthesis) {
        console.warn('Browser speech synthesis not available')
        setLastError({
          code: 'browser-tts-unavailable',
          message: 'Browser speech synthesis is not available.'
        })
        setPlaybackState('idle')
        return
      }

      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.onend = () => setPlaybackState('idle')
      utterance.onerror = event => {
        setLastError({
          code: 'browser-tts-error',
          message: `Browser speech synthesis failed: ${event.error}`
        })
        setPlaybackState('idle')
      }
      setPlaybackState('playing')
      window.speechSynthesis.speak(utterance)
    },
    [cleanup]
  )

  const playServerTTS = useCallback(
    async (text: string, provider: TTSProvider, voiceId?: string) => {
      cleanup()
      setLastError(null)
      setLastNotice(null)
      setLastServedProvider(null)
      setPlaybackState('loading')

      const controller = new AbortController()
      abortRef.current = controller
      let timedOut = false
      timeoutRef.current = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, VOICE_CLIENT_TIMEOUT_MS)

      try {
        const res = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, provider, voiceId }),
          signal: controller.signal
        })

        if (!res.ok) {
          if (res.status === 504) {
            throw Object.assign(
              new Error('Voice synthesis timed out. Please try again.'),
              {
                code: 'tts-timeout'
              }
            )
          }

          throw new Error(`TTS request failed: ${res.status}`)
        }

        const servedProvider =
          (res.headers.get('x-tts-provider') as TTSProvider | null) ?? provider
        const noticeCode = res.headers.get('x-tts-notice')
        const noticeMessage = res.headers.get('x-tts-notice-message')
        setLastServedProvider(servedProvider)
        if (noticeCode && noticeMessage) {
          setLastNotice({
            code: noticeCode,
            message: noticeMessage
          })
        }

        const blob = await res.blob()
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url

        const audio = new Audio(url)
        audioRef.current = audio

        audio.onended = () => {
          setPlaybackState('idle')
          cleanup()
        }
        audio.onerror = event => {
          const eventType = typeof event === 'string' ? event : event.type
          setLastError({
            code: 'tts-audio-error',
            message: `Voice playback failed: ${eventType}`
          })
          setPlaybackState('idle')
          cleanup()
        }

        // Expose audio element FIRST so useAudioStream's useLayoutEffect
        // can connect the AudioContext before playback begins.
        setAudioElement(audio)
        // Defer play to next microtask so React's synchronous render +
        // useLayoutEffect cycle completes (wiring AudioContext) before
        // audio actually starts.
        await new Promise<void>(resolve => queueMicrotask(resolve))
        await audio.play()
        setPlaybackState('playing')

        // Track usage for ElevenLabs
        if (servedProvider === 'elevenlabs') {
          addUsage(text.length)
        }
      } catch (err) {
        const error = err as Error
        if (error.name === 'AbortError') {
          if (timedOut) {
            setLastError({
              code: 'tts-timeout',
              message: 'Voice synthesis timed out. Please try again.'
            })
          }
        } else if (
          (error as Error & { code?: string }).code === 'tts-timeout'
        ) {
          setLastError({
            code: 'tts-timeout',
            message: 'Voice synthesis timed out. Please try again.'
          })
        } else {
          console.error('TTS playback failed:', err)
          setLastError({
            code: 'tts-playback-failed',
            message: error.message
          })
        }
        setPlaybackState('idle')
        cleanup()
      }
    },
    [cleanup]
  )

  const play = useCallback(
    (
      text: string,
      { provider = 'elevenlabs', voiceId }: PlayVoiceOptions = {}
    ) => {
      const truncated = text.slice(0, TTS_MAX_CHARS)

      if (provider === 'browser') {
        playBrowserTTS(truncated)
      } else {
        void playServerTTS(truncated, provider, voiceId)
      }
    },
    [playBrowserTTS, playServerTTS]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      cleanup()
    }
  }, [cleanup])

  return {
    play,
    stop,
    playbackState,
    isPlaying: playbackState === 'playing',
    audioElement,
    lastError,
    lastServedProvider,
    lastNotice
  }
}
