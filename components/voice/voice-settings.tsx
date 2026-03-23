'use client'

import { useState } from 'react'

import { Settings2 } from 'lucide-react'

import { getCookie, setCookie } from '@/lib/utils/cookies'
import type { TTSProvider, VoiceConfig } from '@/lib/voice/config'
import { getUsage, isQuotaWarning } from '@/lib/voice/usage'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'

interface VoiceSettingsProps {
  config: VoiceConfig
  onUpdate: (updates: Partial<VoiceConfig>) => void
}

const TTS_PROVIDERS: {
  value: TTSProvider
  label: string
  description: string
}[] = [
  {
    value: 'elevenlabs',
    label: 'ElevenLabs',
    description: 'Natural voice (10K chars/mo free)'
  },
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'Six voices (paid API key required)'
  },
  {
    value: 'browser',
    label: 'Browser',
    description: 'Built-in voices (free, robotic)'
  }
]

const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

export function VoiceSettings({ config, onUpdate }: VoiceSettingsProps) {
  const [open, setOpen] = useState(false)
  const usage = getUsage()
  const showWarning = isQuotaWarning()

  const handleProviderChange = (provider: TTSProvider) => {
    onUpdate({ ttsProvider: provider })
    setCookie('voiceTTSProvider', provider)
  }

  const handleVoiceChange = (voiceId: string) => {
    onUpdate({ voiceId })
    setCookie('voiceVoiceId', voiceId)
  }

  const handleAutoListenToggle = () => {
    const next = !config.autoListen
    onUpdate({ autoListen: next })
    setCookie('voiceAutoListen', String(next))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Voice settings"
        >
          <Settings2 size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 max-w-[calc(100vw-2rem)]" align="end">
        <div className="space-y-4">
          <div className="text-sm font-medium">Voice Settings</div>

          {/* TTS Provider */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">TTS Provider</div>
            <div className="space-y-1">
              {TTS_PROVIDERS.map(p => (
                <button
                  key={p.value}
                  onClick={() => handleProviderChange(p.value)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    config.ttsProvider === p.value
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Voice picker for OpenAI */}
          {config.ttsProvider === 'openai' && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Voice</div>
              <div className="flex flex-wrap gap-1">
                {OPENAI_VOICES.map(v => (
                  <button
                    key={v}
                    onClick={() => handleVoiceChange(v)}
                    className={`rounded-full px-2.5 py-1 text-xs capitalize transition-colors ${
                      config.voiceId === v
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-accent'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Auto-listen toggle */}
          <div className="flex items-center justify-between">
            <div className="text-sm">Auto-listen after response</div>
            <button
              onClick={handleAutoListenToggle}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                config.autoListen ? 'bg-primary' : 'bg-muted'
              }`}
              role="switch"
              aria-checked={config.autoListen}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  config.autoListen ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* ElevenLabs usage */}
          {config.ttsProvider === 'elevenlabs' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Monthly usage</span>
                <span>
                  {usage.chars.toLocaleString()} /{' '}
                  {usage.limit.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    showWarning ? 'bg-amber-500' : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.min(100, (usage.chars / usage.limit) * 100)}%`
                  }}
                />
              </div>
              {showWarning && (
                <div className="text-xs text-amber-600">
                  Approaching monthly limit. Will fall back to browser TTS.
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Load persisted voice config from cookies.
 */
export function loadVoiceConfig(): Partial<VoiceConfig> {
  const provider = getCookie('voiceTTSProvider') as TTSProvider | null
  const voiceId = getCookie('voiceVoiceId')
  const autoListen = getCookie('voiceAutoListen')

  return {
    ...(provider && { ttsProvider: provider }),
    ...(voiceId && { voiceId }),
    ...(autoListen !== null && { autoListen: autoListen !== 'false' })
  }
}
