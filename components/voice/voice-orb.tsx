'use client'

import { useEffect, useMemo, useState } from 'react'

import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { cn } from '@/lib/utils'
import type { VoiceState } from '@/lib/voice/config'

import { useAudioStream } from '@/hooks/use-audio-stream'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

import { type AgentState, BarVisualizer } from '@/components/ui/bar-visualizer'
import { Button } from '@/components/ui/button'

interface VoiceOrbProps {
  state: VoiceState
  onStop: () => void
  interimTranscript?: string
  mediaStream: MediaStream | null
  audioElement: HTMLAudioElement | null
}

// Map VoiceState → BarVisualizer AgentState
const agentStateMap: Record<VoiceState, AgentState | undefined> = {
  idle: undefined,
  listening: 'listening',
  waiting: 'thinking',
  speaking: 'speaking'
}

const stateLabels: Record<Exclude<VoiceState, 'idle'>, string> = {
  listening: 'Listening',
  waiting: 'Thinking',
  speaking: 'Speaking'
}

function useVoiceBreakpoint() {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)')
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return matches
}

export function VoiceOrb({
  state,
  onStop,
  interimTranscript,
  mediaStream,
  audioElement
}: VoiceOrbProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const isMobileViewport = useVoiceBreakpoint()

  // Convert TTS HTMLAudioElement to MediaStream for the visualizer
  const ttsStream = useAudioStream(state === 'speaking' ? audioElement : null)

  // Pick the right MediaStream for current state
  const visualizerStream = useMemo(() => {
    if (state === 'listening') return mediaStream
    if (state === 'speaking') return ttsStream
    return undefined
  }, [state, mediaStream, ttsStream])

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStop()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onStop])

  if (state === 'idle') return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 300, damping: 25 }
        }
        className="fixed bottom-24 right-6 z-40 flex flex-col items-center gap-2 max-md:inset-x-4 max-md:right-auto max-md:bottom-32 max-md:pb-safe"
        role="status"
        aria-label={`Voice mode: ${stateLabels[state]}`}
        aria-live="polite"
      >
        {/* Interim transcript bubble */}
        <AnimatePresence>
          {interimTranscript && state === 'listening' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="max-w-[calc(100vw-3rem)] sm:max-w-xs rounded-xl bg-background/90 px-4 py-2 text-center text-sm text-foreground shadow-lg backdrop-blur-sm"
            >
              {interimTranscript}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orb container */}
        <div className="relative overflow-hidden rounded-2xl bg-black/90 shadow-2xl backdrop-blur-md">
          {/* Bar visualizer or reduced motion fallback */}
          <div className="flex h-20 w-60 items-center justify-center px-3 max-md:w-full">
            {prefersReducedMotion ? (
              <div
                className={cn(
                  'size-3 rounded-full transition-colors',
                  state === 'speaking' && 'bg-accent-blue',
                  state === 'listening' && 'bg-white/60',
                  state === 'waiting' && 'bg-white/30'
                )}
              />
            ) : (
              <BarVisualizer
                state={agentStateMap[state]}
                mediaStream={visualizerStream}
                barCount={isMobileViewport ? 10 : 15}
                demo={!visualizerStream}
                centerAlign
                minHeight={15}
                maxHeight={100}
                className="h-full w-full rounded-none bg-transparent p-0"
              />
            )}
          </div>

          {/* Bottom bar: state label + stop button */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            <span className="text-xs font-medium text-white/50">
              {stateLabels[state]}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onStop}
              className="size-7 max-md:size-10 rounded-full text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="End voice conversation"
            >
              <X className="size-3.5 max-md:size-5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
