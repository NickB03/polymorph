import { afterEach, describe, expect, it } from 'vitest'

import { deleteCookie, setCookie } from '@/lib/utils/cookies'

import { applyProviderDefaults, loadVoiceConfig } from './voice-settings'

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
