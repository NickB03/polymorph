'use client'

import { Mic, MicOff } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

interface MicButtonProps {
  isListening: boolean
  isSupported: boolean
  onStart: () => void
  onStop: () => void
  disabled?: boolean
}

export function MicButton({
  isListening,
  isSupported,
  onStart,
  onStop,
  disabled
}: MicButtonProps) {
  if (!isSupported) return null

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        'rounded-full',
        isListening && 'animate-pulse border-destructive text-destructive'
      )}
      type="button"
      onClick={isListening ? onStop : onStart}
      disabled={disabled}
      aria-label={isListening ? 'Stop recording' : 'Start recording'}
      title={isListening ? 'Stop recording' : 'Click to speak'}
    >
      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
    </Button>
  )
}
