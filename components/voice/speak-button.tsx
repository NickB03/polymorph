'use client'

import { Loader2, Volume2, VolumeX } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { TTSProvider } from '@/lib/voice/config'

import { useVoicePlayer } from '@/hooks/use-voice-player'

import { Button } from '@/components/ui/button'

interface SpeakButtonProps {
  text: string
  className?: string
}

export function SpeakButton({ text, className }: SpeakButtonProps) {
  const { play, stop, playbackState } = useVoicePlayer()

  if (!text) return null

  const handleClick = () => {
    if (playbackState === 'playing') {
      stop()
    } else {
      // Try server-side TTS first; falls back gracefully
      play(text)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className={cn('rounded-full', className)}
      aria-label={playbackState === 'playing' ? 'Stop speaking' : 'Read aloud'}
    >
      {playbackState === 'loading' ? (
        <Loader2 size={14} className="animate-spin" />
      ) : playbackState === 'playing' ? (
        <VolumeX size={14} />
      ) : (
        <Volume2 size={14} />
      )}
    </Button>
  )
}
