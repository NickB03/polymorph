'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { VoiceError } from '@/lib/voice/config'

/**
 * Wraps the Web Speech API (SpeechRecognition) for voice-to-text input.
 *
 * Uses the browser-native API (free, no API key). Best support in Chrome/Edge.
 * Feature-detects and exposes `isSupported` so callers can hide UI when unavailable.
 */

// Web Speech API type declarations (vendor-prefixed, not always in TS dom lib)
interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface UseVoiceInputOptions {
  /** Language for speech recognition (BCP-47). Defaults to browser locale. */
  lang?: string
  /** Called with the final transcript when recognition completes a phrase */
  onTranscript?: (transcript: string) => void
}

interface UseVoiceInputReturn {
  isListening: boolean
  transcript: string
  interimTranscript: string
  startListening: () => Promise<void>
  stopListening: () => void
  isSupported: boolean
  /** Raw mic MediaStream for audio visualization (null when not listening) */
  mediaStream: MediaStream | null
  lastError: VoiceError | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  const SR =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  return SR || null
}

export function useVoiceInput(
  options: UseVoiceInputOptions = {}
): UseVoiceInputReturn {
  const { lang, onTranscript } = options
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [lastError, setLastError] = useState<VoiceError | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const listeningSessionRef = useRef(0)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  // Defer browser-API detection to an effect so the server and first client
  // render both produce `false`, avoiding a hydration mismatch.
  const [isSupported, setIsSupported] = useState(false)
  useEffect(() => {
    setIsSupported(!!getSpeechRecognition())
  }, [])

  const stopMediaStream = useCallback(() => {
    if (!mediaStreamRef.current) {
      setMediaStream(null)
      return
    }

    mediaStreamRef.current.getTracks().forEach(track => track.stop())
    mediaStreamRef.current = null
    setMediaStream(null)
  }, [])

  const startListening = useCallback(async () => {
    const SpeechRecognitionClass = getSpeechRecognition()
    if (!SpeechRecognitionClass) return

    const sessionId = ++listeningSessionRef.current
    setLastError(null)

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    // Request mic for visualization (SpeechRecognition uses its own internal stream)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (sessionId !== listeningSessionRef.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }

      mediaStreamRef.current = stream
      setMediaStream(stream)
    } catch {
      if (sessionId !== listeningSessionRef.current) return

      // Visualization won't work, but STT still functions
      console.warn('getUserMedia unavailable — voice visualization disabled')
    }

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = true
    if (lang) recognition.lang = lang

    recognition.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''
      const startIndex =
        typeof event.resultIndex === 'number' ? event.resultIndex : 0

      for (let i = startIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }

      if (finalText) {
        setTranscript(finalText)
        onTranscriptRef.current?.(finalText)
      }
      setInterimTranscript(interimText)
    }

    recognition.onerror = (event: any) => {
      if (sessionId !== listeningSessionRef.current) return

      // 'aborted' is expected when we call stop/abort — not a real error
      if (event.error !== 'aborted') {
        console.warn('Speech recognition error:', event.error)
        setLastError({
          code: 'speech-recognition-error',
          message: `Speech recognition failed: ${event.error}`
        })
      }
      recognitionRef.current = null
      stopMediaStream()
      setIsListening(false)
    }

    recognition.onend = () => {
      if (sessionId !== listeningSessionRef.current) return

      recognitionRef.current = null
      stopMediaStream()
      setIsListening(false)
    }

    if (sessionId !== listeningSessionRef.current) {
      return
    }

    try {
      recognitionRef.current = recognition
      recognition.start()
      setIsListening(true)
      setTranscript('')
      setInterimTranscript('')
    } catch (error) {
      recognitionRef.current = null
      stopMediaStream()
      setIsListening(false)
      setLastError({
        code: 'recognition-start-failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to start speech recognition'
      })
    }
  }, [lang, stopMediaStream])

  const stopListening = useCallback(() => {
    listeningSessionRef.current += 1

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    stopMediaStream()
    setIsListening(false)
  }, [stopMediaStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
      stopMediaStream()
    }
  }, [stopMediaStream])

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    isSupported,
    mediaStream,
    lastError
  }
}
