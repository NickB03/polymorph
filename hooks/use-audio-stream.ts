'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Converts an HTMLAudioElement into a MediaStream for visualization.
 *
 * Uses Web Audio API's createMediaStreamDestination() to tap the audio
 * without interrupting playback. The original audio still plays through
 * speakers via the AudioContext destination.
 */
export function useAudioStream(
  audioElement: HTMLAudioElement | null
): MediaStream | null {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)

  useEffect(() => {
    if (!audioElement) {
      setStream(null)
      return
    }

    const ctx = new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()

    contextRef.current = ctx

    const source = ctx.createMediaElementSource(audioElement)
    sourceRef.current = source

    const dest = ctx.createMediaStreamDestination()

    // Route audio to both: visualizer (via dest.stream) AND speakers (via ctx.destination)
    source.connect(dest)
    source.connect(ctx.destination)

    setStream(dest.stream)

    return () => {
      source.disconnect()
      ctx.close()
      contextRef.current = null
      sourceRef.current = null
      setStream(null)
    }
  }, [audioElement])

  return stream
}
