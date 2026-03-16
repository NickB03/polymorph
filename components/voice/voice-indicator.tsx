'use client'

import { Loader2, Mic, Volume2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { VoiceState } from '@/lib/voice/config'

interface VoiceIndicatorProps {
  state: VoiceState
  className?: string
}

const stateConfig: Record<
  Exclude<VoiceState, 'idle'>,
  { label: string; icon: typeof Mic; iconClass?: string }
> = {
  listening: {
    label: 'Listening...',
    icon: Mic,
    iconClass: 'animate-pulse text-red-500'
  },
  waiting: {
    label: 'Thinking...',
    icon: Loader2,
    iconClass: 'animate-spin'
  },
  speaking: {
    label: 'Speaking...',
    icon: Volume2,
    iconClass: 'animate-pulse'
  }
}

export function VoiceIndicator({ state, className }: VoiceIndicatorProps) {
  if (state === 'idle') return null

  const { label, icon: Icon, iconClass } = stateConfig[state]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Icon size={12} className={iconClass} />
      {label}
    </div>
  )
}
