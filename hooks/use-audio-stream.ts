'use client'

import { useLayoutEffect, useRef, useState } from 'react'

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
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)

  useLayoutEffect(() => {
    const ctx = new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()

    contextRef.current = ctx
    destinationRef.current = ctx.createMediaStreamDestination()

    return () => {
      sourceRef.current?.disconnect()
      sourceRef.current = null
      destinationRef.current = null
      ctx.close()
      contextRef.current = null
      setStream(null)
    }
  }, [])

  useLayoutEffect(() => {
    const ctx = contextRef.current
    const destination = destinationRef.current

    sourceRef.current?.disconnect()
    sourceRef.current = null

    if (!audioElement || !ctx || !destination) {
      setStream(null)
      return
    }

    const source = ctx.createMediaElementSource(audioElement)
    sourceRef.current = source

    // Route audio to both: visualizer (via destination.stream) AND speakers.
    source.connect(destination)
    source.connect(ctx.destination)
    setStream(destination.stream)

    return () => {
      source.disconnect()
      sourceRef.current = null
      setStream(null)
    }
  }, [audioElement])

  return stream
}
