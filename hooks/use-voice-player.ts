'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { TTSProvider } from '@/lib/voice/config'
import { TTS_MAX_CHARS } from '@/lib/voice/config'
import { addUsage } from '@/lib/voice/usage'

type PlaybackState = 'idle' | 'loading' | 'playing'

interface UseVoicePlayerReturn {
  play: (text: string, provider?: TTSProvider) => void
  stop: () => void
  playbackState: PlaybackState
  isPlaying: boolean
}

/**
 * Manages TTS playback.
 *
 * For 'browser' provider, uses window.speechSynthesis directly (client-only).
 * For 'elevenlabs' / 'openai', fetches audio from /api/voice/synthesize.
 */
export function useVoicePlayer(): UseVoicePlayerReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
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

  const playBrowserTTS = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      console.warn('Browser speech synthesis not available')
      setPlaybackState('idle')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => setPlaybackState('idle')
    utterance.onerror = () => setPlaybackState('idle')
    setPlaybackState('playing')
    window.speechSynthesis.speak(utterance)
  }, [])

  const playServerTTS = useCallback(
    async (text: string, provider: TTSProvider) => {
      cleanup()
      setPlaybackState('loading')

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/voice/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, provider }),
          signal: controller.signal
        })

        if (!res.ok) {
          throw new Error(`TTS request failed: ${res.status}`)
        }

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url

        const audio = new Audio(url)
        audioRef.current = audio

        audio.onended = () => {
          setPlaybackState('idle')
          cleanup()
        }
        audio.onerror = () => {
          setPlaybackState('idle')
          cleanup()
        }

        setPlaybackState('playing')
        await audio.play()

        // Track usage for ElevenLabs
        if (provider === 'elevenlabs') {
          addUsage(text.length)
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('TTS playback failed:', err)
        }
        setPlaybackState('idle')
        cleanup()
      }
    },
    [cleanup]
  )

  const play = useCallback(
    (text: string, provider: TTSProvider = 'elevenlabs') => {
      const truncated = text.slice(0, TTS_MAX_CHARS)

      if (provider === 'browser') {
        playBrowserTTS(truncated)
      } else {
        playServerTTS(truncated, provider)
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
    isPlaying: playbackState === 'playing'
  }
}
