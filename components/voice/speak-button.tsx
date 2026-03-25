'use client'

import { useEffect, useRef } from 'react'

import { Loader2, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

import { useVoicePlayer } from '@/hooks/use-voice-player'

import { Button } from '@/components/ui/button'

interface SpeakButtonProps {
  text: string
  className?: string
}

export function SpeakButton({ text, className }: SpeakButtonProps) {
  const { play, stop, playbackState, lastError, lastNotice } = useVoicePlayer()
  const lastErrorRef = useRef<string | null>(null)
  const lastNoticeRef = useRef<string | null>(null)

  useEffect(() => {
    if (!lastError) {
      lastErrorRef.current = null
      return
    }

    const fingerprint = `${lastError.code}:${lastError.message}`
    if (lastErrorRef.current === fingerprint) return

    lastErrorRef.current = fingerprint
    toast.error(lastError.message)
  }, [lastError])

  useEffect(() => {
    if (!lastNotice) {
      lastNoticeRef.current = null
      return
    }

    const fingerprint = `${lastNotice.code}:${lastNotice.message}`
    if (lastNoticeRef.current === fingerprint) return

    lastNoticeRef.current = fingerprint
    toast(lastNotice.message)
  }, [lastNotice])

  if (!text) return null

  const handleClick = () => {
    if (playbackState === 'playing') {
      stop()
    } else {
      // Try server-side TTS first; falls back gracefully
      play(text, { provider: 'elevenlabs' })
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
