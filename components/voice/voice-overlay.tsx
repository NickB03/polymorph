'use client'

import { useEffect, useRef } from 'react'

import { Mic, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { VoiceState } from '@/lib/voice/config'

import { Button } from '@/components/ui/button'

interface VoiceOverlayProps {
  state: VoiceState
  onStop: () => void
  interimTranscript?: string
}

/**
 * Full-screen voice conversation overlay.
 * Shows an animated orb that responds to voice states,
 * a live transcript, and a stop button.
 */
export function VoiceOverlay({
  state,
  onStop,
  interimTranscript
}: VoiceOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Trap focus inside the overlay when it's visible
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStop()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onStop])

  const stateLabel: Record<Exclude<VoiceState, 'idle'>, string> = {
    listening: 'Listening',
    waiting: 'Thinking',
    speaking: 'Speaking'
  }

  if (state === 'idle') return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Voice conversation"
    >
      {/* Animated orb */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulse rings */}
        <div
          className={cn(
            'absolute size-48 rounded-full transition-all duration-700',
            state === 'listening' &&
              'animate-[voice-pulse_2s_ease-in-out_infinite] bg-white/5',
            state === 'waiting' &&
              'animate-[voice-orbit_3s_linear_infinite] bg-white/3',
            state === 'speaking' &&
              'animate-[voice-pulse_1s_ease-in-out_infinite] bg-white/8'
          )}
        />
        <div
          className={cn(
            'absolute size-36 rounded-full transition-all duration-700',
            state === 'listening' &&
              'animate-[voice-pulse_2s_ease-in-out_infinite_0.3s] bg-white/8',
            state === 'waiting' &&
              'animate-[voice-orbit_2s_linear_infinite_reverse] bg-white/5',
            state === 'speaking' &&
              'animate-[voice-pulse_0.8s_ease-in-out_infinite_0.2s] bg-white/10'
          )}
        />

        {/* Core orb */}
        <div
          className={cn(
            'relative z-10 flex size-24 items-center justify-center rounded-full transition-all duration-500',
            state === 'listening' &&
              'bg-white/15 shadow-[0_0_40px_rgba(255,255,255,0.15)]',
            state === 'waiting' &&
              'bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.08)]',
            state === 'speaking' &&
              'bg-white/20 shadow-[0_0_60px_rgba(255,255,255,0.2)]'
          )}
        >
          {state === 'listening' && (
            <Mic size={32} className="animate-pulse text-white" />
          )}
          {state === 'waiting' && (
            <div className="flex gap-1.5">
              <div className="size-2 animate-[voice-dot_1.4s_ease-in-out_infinite] rounded-full bg-white/60" />
              <div className="size-2 animate-[voice-dot_1.4s_ease-in-out_infinite_0.2s] rounded-full bg-white/60" />
              <div className="size-2 animate-[voice-dot_1.4s_ease-in-out_infinite_0.4s] rounded-full bg-white/60" />
            </div>
          )}
          {state === 'speaking' && (
            <div className="flex items-end gap-1">
              {[0, 0.1, 0.2, 0.3, 0.2].map((delay, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-white/80"
                  style={{
                    animation: `voice-bar 0.8s ease-in-out ${delay}s infinite alternate`,
                    height: '8px'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* State label */}
      <div className="mt-10 text-sm font-medium tracking-widest uppercase text-white/60">
        {stateLabel[state]}
      </div>

      {/* Live transcript */}
      {interimTranscript && state === 'listening' && (
        <div className="mx-8 mt-6 max-w-md text-center text-lg text-white/80">
          {interimTranscript}
        </div>
      )}

      {/* Stop button */}
      <Button
        variant="outline"
        size="lg"
        onClick={onStop}
        className="mt-12 gap-2 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
      >
        <X size={18} />
        End conversation
      </Button>
    </div>
  )
}
