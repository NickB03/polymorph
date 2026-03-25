import { afterEach, describe, expect, it } from 'vitest'

import { deleteCookie, setCookie } from '@/lib/utils/cookies'

import { loadVoiceConfig } from './voice-settings'

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
})
