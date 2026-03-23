/**
 * Voice feature configuration and types.
 *
 * Feature-gated behind NEXT_PUBLIC_ENABLE_VOICE.
 */

export type VoiceState = 'idle' | 'listening' | 'waiting' | 'speaking'

export type TTSProvider = 'elevenlabs' | 'openai' | 'browser'

export interface VoiceConfig {
  ttsProvider: TTSProvider
  voiceId: string
  speechRate: number
  autoListen: boolean
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  ttsProvider: 'elevenlabs',
  voiceId: 'DXFkLCBUTmvXpp2QwZjA', // ElevenLabs "Eryn" — AI Assistant
  speechRate: 1.0,
  autoListen: true
}

/** Max characters to synthesize per response (long responses are truncated for voice) */
export const TTS_MAX_CHARS = 2000

export function isVoiceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_VOICE === 'true'
}
