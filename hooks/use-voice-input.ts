'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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
  startListening: () => void
  stopListening: () => void
  isSupported: boolean
  /** Raw mic MediaStream for audio visualization (null when not listening) */
  mediaStream: MediaStream | null
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
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  // Defer browser-API detection to an effect so the server and first client
  // render both produce `false`, avoiding a hydration mismatch.
  const [isSupported, setIsSupported] = useState(false)
  useEffect(() => {
    setIsSupported(!!getSpeechRecognition())
  }, [])

  const startListening = useCallback(async () => {
    const SpeechRecognitionClass = getSpeechRecognition()
    if (!SpeechRecognitionClass) return

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }

    // Request mic for visualization (SpeechRecognition uses its own internal stream)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      setMediaStream(stream)
    } catch {
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

      for (let i = 0; i < event.results.length; i++) {
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
      // 'aborted' is expected when we call stop/abort — not a real error
      if (event.error !== 'aborted') {
        console.warn('Speech recognition error:', event.error)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setTranscript('')
    setInterimTranscript('')
  }, [lang])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    mediaStreamRef.current?.getTracks().forEach(track => track.stop())
    mediaStreamRef.current = null
    setMediaStream(null)
    setIsListening(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
      mediaStreamRef.current?.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
  }, [])

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    isSupported,
    mediaStream
  }
}
