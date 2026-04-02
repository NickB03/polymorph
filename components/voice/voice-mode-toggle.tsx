'use client'

import { AudioLines, X } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

interface VoiceModeToggleProps {
  isActive: boolean
  onStart: () => void
  onStop: () => void
  disabled?: boolean
  className?: string
}

export function VoiceModeToggle({
  isActive,
  onStart,
  onStop,
  disabled,
  className
}: VoiceModeToggleProps) {
  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="icon"
      className={cn(
        'rounded-full',
        isActive && 'bg-destructive hover:bg-destructive/90',
        className
      )}
      type="button"
      onClick={isActive ? onStop : onStart}
      disabled={disabled}
      aria-label={isActive ? 'Stop voice mode' : 'Start voice mode'}
      title={isActive ? 'Stop voice conversation' : 'Start voice conversation'}
    >
      {isActive ? <X size={18} /> : <AudioLines size={18} />}
    </Button>
  )
}
