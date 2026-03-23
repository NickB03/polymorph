'use client'

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils/index'

export interface AudioAnalyserOptions {
  fftSize?: number
  smoothingTimeConstant?: number
  minDecibels?: number
  maxDecibels?: number
}

function createAudioAnalyser(
  mediaStream: MediaStream,
  options: AudioAnalyserOptions = {}
) {
  const audioContext = new (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  )()
  const source = audioContext.createMediaStreamSource(mediaStream)
  const analyser = audioContext.createAnalyser()

  if (options.fftSize) analyser.fftSize = options.fftSize
  if (options.smoothingTimeConstant !== undefined) {
    analyser.smoothingTimeConstant = options.smoothingTimeConstant
  }
  if (options.minDecibels !== undefined)
    analyser.minDecibels = options.minDecibels
  if (options.maxDecibels !== undefined)
    analyser.maxDecibels = options.maxDecibels

  source.connect(analyser)

  const cleanup = () => {
    source.disconnect()
    audioContext.close()
  }

  return { analyser, audioContext, cleanup }
}

/**
 * Hook for tracking the volume of an audio stream using the Web Audio API.
 * @param mediaStream - The MediaStream to analyze
 * @param options - Audio analyser options
 * @returns The current volume level (0-1)
 */
export function useAudioVolume(
  mediaStream?: MediaStream | null,
  options: AudioAnalyserOptions = { fftSize: 32, smoothingTimeConstant: 0 }
) {
  const [volume, setVolume] = useState(0)
  const volumeRef = useRef(0)
  const frameId = useRef<number | undefined>(undefined)
  const { fftSize, smoothingTimeConstant, minDecibels, maxDecibels } = options

  // Memoize options to prevent unnecessary re-renders
  const memoizedOptions = useMemo(
    () => ({ fftSize, smoothingTimeConstant, minDecibels, maxDecibels }),
    [fftSize, smoothingTimeConstant, minDecibels, maxDecibels]
  )

  useEffect(() => {
    if (!mediaStream) {
      setVolume(0)
      volumeRef.current = 0
      return
    }

    const { analyser, cleanup } = createAudioAnalyser(
      mediaStream,
      memoizedOptions
    )

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    let lastUpdate = 0
    const updateInterval = 1000 / 30 // 30 FPS

    const updateVolume = (timestamp: number) => {
      if (timestamp - lastUpdate >= updateInterval) {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const a = dataArray[i]
          sum += a * a
        }
        const newVolume = Math.sqrt(sum / dataArray.length) / 255

        // Only update state if volume changed significantly
        if (Math.abs(newVolume - volumeRef.current) > 0.01) {
          volumeRef.current = newVolume
          setVolume(newVolume)
        }
        lastUpdate = timestamp
      }
      frameId.current = requestAnimationFrame(updateVolume)
    }

    frameId.current = requestAnimationFrame(updateVolume)

    return () => {
      cleanup()
      if (frameId.current) {
        cancelAnimationFrame(frameId.current)
      }
    }
  }, [mediaStream, memoizedOptions])

  return volume
}

export interface MultiBandVolumeOptions {
  bands?: number
  loPass?: number // Low frequency cutoff
  hiPass?: number // High frequency cutoff
  updateInterval?: number // Update interval in ms
  analyserOptions?: AudioAnalyserOptions
}

interface ResolvedMultiBandVolumeOptions {
  bands: number
  loPass: number
  hiPass: number
  updateInterval: number
  analyserOptions: AudioAnalyserOptions
}

const multibandDefaults: ResolvedMultiBandVolumeOptions = {
  bands: 5,
  loPass: 100,
  hiPass: 600,
  updateInterval: 32,
  analyserOptions: { fftSize: 2048 }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export function resolveMultiBandOptions(
  options: MultiBandVolumeOptions = {}
): ResolvedMultiBandVolumeOptions {
  const { bands, loPass, hiPass, updateInterval, analyserOptions } = options

  return {
    ...multibandDefaults,
    ...(bands !== undefined ? { bands } : {}),
    ...(loPass !== undefined ? { loPass } : {}),
    ...(hiPass !== undefined ? { hiPass } : {}),
    ...(updateInterval !== undefined ? { updateInterval } : {}),
    analyserOptions: {
      ...multibandDefaults.analyserOptions,
      ...(analyserOptions?.fftSize !== undefined
        ? { fftSize: analyserOptions.fftSize }
        : {}),
      ...(analyserOptions?.smoothingTimeConstant !== undefined
        ? { smoothingTimeConstant: analyserOptions.smoothingTimeConstant }
        : {}),
      ...(analyserOptions?.minDecibels !== undefined
        ? { minDecibels: analyserOptions.minDecibels }
        : {}),
      ...(analyserOptions?.maxDecibels !== undefined
        ? { maxDecibels: analyserOptions.maxDecibels }
        : {})
    }
  }
}

export function resolveFrequencyBinRange({
  loPass,
  hiPass,
  frequencyBinCount,
  sampleRate
}: {
  loPass: number
  hiPass: number
  frequencyBinCount: number
  sampleRate: number
}) {
  const nyquist = sampleRate / 2
  const maxBin = Math.max(0, frequencyBinCount - 1)
  const loBin = clamp(
    Math.floor((loPass / nyquist) * frequencyBinCount),
    0,
    maxBin
  )
  const hiBin = clamp(
    Math.ceil((hiPass / nyquist) * frequencyBinCount),
    loBin + 1,
    frequencyBinCount
  )

  return { loBin, hiBin }
}

// Memoized normalization function to avoid recreating on each render
const normalizeDb = (value: number) => {
  if (value === -Infinity) return 0
  const minDb = -100
  const maxDb = -10
  const db = 1 - (Math.max(minDb, Math.min(maxDb, value)) * -1) / 100
  return Math.sqrt(db)
}

/**
 * Hook for tracking volume across multiple frequency bands
 * @param mediaStream - The MediaStream to analyze
 * @param options - Multiband options
 * @returns Array of volume levels for each frequency band
 */
export function useMultibandVolume(
  mediaStream?: MediaStream | null,
  options: MultiBandVolumeOptions = {}
) {
  const { bands, loPass, hiPass, updateInterval, analyserOptions } = options
  const analyserFftSize = analyserOptions?.fftSize
  const analyserSmoothingTimeConstant = analyserOptions?.smoothingTimeConstant
  const analyserMinDecibels = analyserOptions?.minDecibels
  const analyserMaxDecibels = analyserOptions?.maxDecibels

  const opts = useMemo(
    () =>
      resolveMultiBandOptions({
        bands,
        loPass,
        hiPass,
        updateInterval,
        analyserOptions: {
          ...(analyserFftSize !== undefined
            ? { fftSize: analyserFftSize }
            : {}),
          ...(analyserSmoothingTimeConstant !== undefined
            ? { smoothingTimeConstant: analyserSmoothingTimeConstant }
            : {}),
          ...(analyserMinDecibels !== undefined
            ? { minDecibels: analyserMinDecibels }
            : {}),
          ...(analyserMaxDecibels !== undefined
            ? { maxDecibels: analyserMaxDecibels }
            : {})
        }
      }),
    [
      bands,
      loPass,
      hiPass,
      updateInterval,
      analyserFftSize,
      analyserSmoothingTimeConstant,
      analyserMinDecibels,
      analyserMaxDecibels
    ]
  )

  const [frequencyBands, setFrequencyBands] = useState<number[]>(() =>
    new Array(opts.bands).fill(0)
  )
  const bandsRef = useRef<number[]>(new Array(opts.bands).fill(0))
  const frameId = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!mediaStream) {
      const emptyBands = new Array(opts.bands).fill(0)
      setFrequencyBands(emptyBands)
      bandsRef.current = emptyBands
      return
    }

    const { analyser, cleanup } = createAudioAnalyser(
      mediaStream,
      opts.analyserOptions
    )

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Float32Array(bufferLength)
    const { loBin, hiBin } = resolveFrequencyBinRange({
      loPass: opts.loPass,
      hiPass: opts.hiPass,
      frequencyBinCount: bufferLength,
      sampleRate: analyser.context.sampleRate
    })
    const sliceLength = hiBin - loBin
    const chunkSize = Math.max(1, Math.ceil(sliceLength / opts.bands))

    let lastUpdate = 0
    const updateInterval = opts.updateInterval!

    const updateVolume = (timestamp: number) => {
      if (timestamp - lastUpdate >= updateInterval) {
        analyser.getFloatFrequencyData(dataArray)

        // Process directly without creating intermediate arrays
        const chunks = new Array(opts.bands)

        for (let i = 0; i < opts.bands; i++) {
          let sum = 0
          let count = 0
          const startIdx = loBin + i * chunkSize
          const endIdx = Math.min(loBin + (i + 1) * chunkSize, hiBin)

          for (let j = startIdx; j < endIdx; j++) {
            sum += normalizeDb(dataArray[j])
            count++
          }

          chunks[i] = count > 0 ? sum / count : 0
        }

        // Only update state if bands changed significantly
        let hasChanged = false
        for (let i = 0; i < chunks.length; i++) {
          if (Math.abs(chunks[i] - bandsRef.current[i]) > 0.01) {
            hasChanged = true
            break
          }
        }

        if (hasChanged) {
          bandsRef.current = chunks
          setFrequencyBands(chunks)
        }

        lastUpdate = timestamp
      }

      frameId.current = requestAnimationFrame(updateVolume)
    }

    frameId.current = requestAnimationFrame(updateVolume)

    return () => {
      cleanup()
      if (frameId.current) {
        cancelAnimationFrame(frameId.current)
      }
    }
  }, [mediaStream, opts])

  return frequencyBands
}

type AnimationState =
  | 'connecting'
  | 'initializing'
  | 'listening'
  | 'speaking'
  | 'thinking'
  | undefined

export const useBarAnimator = (
  state: AnimationState,
  columns: number,
  interval: number
): number[] => {
  const indexRef = useRef(0)
  const [currentFrame, setCurrentFrame] = useState<number[]>([])
  const animationFrameId = useRef<number | null>(null)

  // Memoize sequence generation
  const sequence = useMemo(() => {
    if (state === 'thinking') {
      return generateThinkingSequenceBar(columns)
    } else if (state === 'listening') {
      return generateListeningSequenceBar(columns)
    } else if (state === 'connecting' || state === 'initializing') {
      return generateConnectingSequenceBar(columns)
    } else if (state === undefined || state === 'speaking') {
      return [new Array(columns).fill(0).map((_, idx) => idx)]
    } else {
      return [[]]
    }
  }, [state, columns])

  useEffect(() => {
    indexRef.current = 0
    setCurrentFrame(sequence[0] || [])
  }, [sequence])

  useEffect(() => {
    let startTime = performance.now()

    const animate = (time: DOMHighResTimeStamp) => {
      const timeElapsed = time - startTime

      if (timeElapsed >= interval) {
        indexRef.current = (indexRef.current + 1) % sequence.length
        setCurrentFrame(sequence[indexRef.current] || [])
        startTime = time
      }

      animationFrameId.current = requestAnimationFrame(animate)
    }

    animationFrameId.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }
  }, [interval, sequence])

  return currentFrame
}

// Memoize sequence generators
const generateConnectingSequenceBar = (columns: number): number[][] => {
  const seq = []
  for (let x = 0; x < columns; x++) {
    seq.push([x, columns - 1 - x])
  }
  return seq
}

const generateListeningSequenceBar = (columns: number): number[][] => {
  const center = Math.floor(columns / 2)
  const noIndex = -1
  return [[center], [noIndex]]
}

export const generateThinkingSequenceBar = (columns: number): number[][] => {
  const center = Math.floor(columns / 2)
  if (columns <= 1) return [[0]]

  const seq: number[][] = []
  // Expand outward from center
  for (let r = 0; r <= center; r++) {
    const left = center - r
    const right = center + r
    if (left === right) {
      seq.push([center])
    } else if (right < columns) {
      seq.push([left, right])
    } else {
      seq.push([left, columns - 1])
    }
  }
  // Contract back (skip first and last to avoid duplicates)
  for (let i = seq.length - 2; i > 0; i--) {
    seq.push(seq[i])
  }
  return seq
}

export type AgentState =
  | 'connecting'
  | 'initializing'
  | 'listening'
  | 'speaking'
  | 'thinking'

export interface BarVisualizerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Voice assistant state */
  state?: AgentState
  /** Number of bars to display */
  barCount?: number
  /** Audio source */
  mediaStream?: MediaStream | null
  /** Min/max height as percentage */
  minHeight?: number
  maxHeight?: number
  /** Enable demo mode with fake audio data */
  demo?: boolean
  /** Align bars from center instead of bottom */
  centerAlign?: boolean
}

const BarVisualizerComponent = React.forwardRef<
  HTMLDivElement,
  BarVisualizerProps
>(
  (
    {
      state,
      barCount = 15,
      mediaStream,
      minHeight = 20,
      maxHeight = 100,
      demo = false,
      centerAlign = false,
      className,
      style,
      ...props
    },
    ref
  ) => {
    // Audio processing
    const realVolumeBands = useMultibandVolume(mediaStream, {
      bands: barCount,
      loPass: 100,
      hiPass: 200
    })

    // Generate fake volume data for demo mode using refs to avoid state updates
    const fakeVolumeBandsRef = useRef<number[]>(new Array(barCount).fill(0.2))
    const [fakeVolumeBands, setFakeVolumeBands] = useState<number[]>(() =>
      new Array(barCount).fill(0.2)
    )
    const fakeAnimationRef = useRef<number | undefined>(undefined)

    // Animate fake volume bands for speaking and listening states
    useEffect(() => {
      if (!demo) return

      if (
        state !== 'speaking' &&
        state !== 'listening' &&
        state !== 'thinking'
      ) {
        const bands = new Array(barCount).fill(0.2)
        fakeVolumeBandsRef.current = bands
        setFakeVolumeBands(bands)
        return
      }

      let lastUpdate = 0
      const updateInterval = 50
      const startTime = Date.now() / 1000

      const updateFakeVolume = (timestamp: number) => {
        if (timestamp - lastUpdate >= updateInterval) {
          const time = Date.now() / 1000 - startTime
          const newBands = new Array(barCount)

          for (let i = 0; i < barCount; i++) {
            const waveOffset = i * 0.5
            const baseVolume = Math.sin(time * 2 + waveOffset) * 0.3 + 0.5
            const randomNoise = Math.random() * 0.2
            newBands[i] = Math.max(0.1, Math.min(1, baseVolume + randomNoise))
          }

          // Only update if values changed significantly
          let hasChanged = false
          for (let i = 0; i < barCount; i++) {
            if (Math.abs(newBands[i] - fakeVolumeBandsRef.current[i]) > 0.05) {
              hasChanged = true
              break
            }
          }

          if (hasChanged) {
            fakeVolumeBandsRef.current = newBands
            setFakeVolumeBands(newBands)
          }

          lastUpdate = timestamp
        }

        fakeAnimationRef.current = requestAnimationFrame(updateFakeVolume)
      }

      fakeAnimationRef.current = requestAnimationFrame(updateFakeVolume)

      return () => {
        if (fakeAnimationRef.current) {
          cancelAnimationFrame(fakeAnimationRef.current)
        }
      }
    }, [demo, state, barCount])

    // Use fake or real volume data based on demo mode
    const volumeBands = useMemo(
      () => (demo ? fakeVolumeBands : realVolumeBands),
      [demo, fakeVolumeBands, realVolumeBands]
    )

    // Animation sequencing
    const highlightedIndices = useBarAnimator(
      state,
      barCount,
      state === 'connecting'
        ? 2000 / barCount
        : state === 'thinking'
          ? 120
          : state === 'listening'
            ? 500
            : 1000
    )

    return (
      <div
        ref={ref}
        data-state={state}
        className={cn(
          'relative flex justify-center gap-1.5',
          centerAlign ? 'items-center' : 'items-end',
          'bg-muted h-32 w-full overflow-hidden rounded-lg p-4',
          className
        )}
        style={{
          ...style
        }}
        {...props}
      >
        {volumeBands.map((volume, index) => {
          const heightPct = Math.min(
            maxHeight,
            Math.max(minHeight, volume * 100 + 5)
          )
          const isHighlighted = highlightedIndices?.includes(index) ?? false

          return (
            <Bar
              key={index}
              heightPct={heightPct}
              isHighlighted={isHighlighted}
              state={state}
            />
          )
        })}
      </div>
    )
  }
)

// Memoized Bar component to prevent unnecessary re-renders
const Bar = React.memo<{
  heightPct: number
  isHighlighted: boolean
  state?: AgentState
}>(({ heightPct, isHighlighted, state }) => (
  <div
    data-highlighted={isHighlighted}
    className={cn(
      'max-w-[12px] min-w-[8px] flex-1 transition-all duration-150',
      'rounded-full',
      'bg-border data-[highlighted=true]:bg-primary',
      state === 'speaking' && 'bg-primary',
      state === 'thinking' && isHighlighted && 'animate-pulse'
    )}
    style={{
      height: `${heightPct}%`,
      animationDuration: state === 'thinking' ? '300ms' : undefined
    }}
  />
))

Bar.displayName = 'Bar'

// Wrap the main component with React.memo for prop comparison optimization
const BarVisualizer = React.memo(BarVisualizerComponent)

BarVisualizerComponent.displayName = 'BarVisualizerComponent'
BarVisualizer.displayName = 'BarVisualizer'

export { BarVisualizer }
