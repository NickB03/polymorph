/**
 * Voice feature configuration and types.
 *
 * Feature-gated behind NEXT_PUBLIC_ENABLE_VOICE.
 */

export type VoiceState = 'idle' | 'listening' | 'waiting' | 'speaking'

export type TTSProvider = 'elevenlabs' | 'openai' | 'browser'

export interface VoiceError {
  code: string
  message: string
}

export interface VoiceNotice {
  code: string
  message: string
}

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

/** Client-side timeout waiting for synthesized audio. Must exceed 2× VOICE_PROVIDER_TIMEOUT_MS to allow full provider fallback chain. */
export const VOICE_CLIENT_TIMEOUT_MS = 20_000

/** Server-side provider timeout for upstream TTS requests. */
export const VOICE_PROVIDER_TIMEOUT_MS = 8_000

/** How long assistant text must be stable before triggering TTS (ms).
 *  Allows synthesis to start while the agent is still running tool calls. */
export const TTS_TEXT_DEBOUNCE_MS = 1500

export function isVoiceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_VOICE === 'true'
}
