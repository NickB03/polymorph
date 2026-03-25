import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { deleteCookie, setCookie } from '@/lib/utils/cookies'
import type { VoiceConfig } from '@/lib/voice/config'

vi.mock('@/lib/voice/usage', () => ({
  getUsage: vi.fn(() => ({ chars: 0, limit: 10000 })),
  isQuotaWarning: vi.fn(() => false)
}))

import {
  applyProviderDefaults,
  loadVoiceConfig,
  VoiceSettings
} from './voice-settings'

describe('loadVoiceConfig', () => {
  afterEach(() => {
    deleteCookie('voiceTTSProvider')
    deleteCookie('voiceVoiceId')
    deleteCookie('voiceAutoListen')
  })

  it('normalizes invalid provider cookies and malformed autoListen values', () => {
    setCookie('voiceTTSProvider', 'invalid-provider')
    setCookie('voiceVoiceId', 'nova')
    setCookie('voiceAutoListen', 'maybe')

    expect(loadVoiceConfig()).toEqual({
      autoListen: true
    })
  })

  it('keeps valid provider and matching voice selections', () => {
    setCookie('voiceTTSProvider', 'openai')
    setCookie('voiceVoiceId', 'nova')
    setCookie('voiceAutoListen', 'false')

    expect(loadVoiceConfig()).toEqual({
      ttsProvider: 'openai',
      voiceId: 'nova',
      autoListen: false
    })
  })

  it('drops an OpenAI voice name when provider is elevenlabs', () => {
    setCookie('voiceTTSProvider', 'elevenlabs')
    setCookie('voiceVoiceId', 'nova')

    expect(loadVoiceConfig()).toEqual({
      ttsProvider: 'elevenlabs'
    })
  })
})

describe('applyProviderDefaults', () => {
  it('resets voiceId for each provider', () => {
    expect(applyProviderDefaults('elevenlabs')).toEqual({
      ttsProvider: 'elevenlabs',
      voiceId: 'DXFkLCBUTmvXpp2QwZjA'
    })

    expect(applyProviderDefaults('openai')).toEqual({
      ttsProvider: 'openai',
      voiceId: 'alloy'
    })

    expect(applyProviderDefaults('browser')).toEqual({
      ttsProvider: 'browser',
      voiceId: ''
    })
  })
})

describe('VoiceSettings', () => {
  it('calls onUpdate with both ttsProvider and voiceId when provider changes', () => {
    const onUpdate = vi.fn()
    const config: VoiceConfig = {
      ttsProvider: 'openai',
      voiceId: 'nova',
      speechRate: 1,
      autoListen: true
    }

    render(<VoiceSettings config={config} onUpdate={onUpdate} />)

    // Open the settings popover
    fireEvent.click(screen.getByRole('button', { name: /voice settings/i }))

    // Click the ElevenLabs provider button — switching from OpenAI should reset voiceId
    fireEvent.click(screen.getByText('ElevenLabs'))

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({
      ttsProvider: 'elevenlabs',
      voiceId: 'DXFkLCBUTmvXpp2QwZjA'
    })
  })
})
