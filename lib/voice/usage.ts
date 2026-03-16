/**
 * Client-side TTS usage tracking.
 * Tracks characters synthesized per month in localStorage to warn
 * when approaching ElevenLabs free tier limit (10K chars/month).
 */

const STORAGE_KEY = 'voice-tts-usage'
const ELEVENLABS_MONTHLY_LIMIT = 10_000

interface UsageData {
  month: string // "YYYY-MM"
  chars: number
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function loadUsage(): UsageData {
  if (typeof window === 'undefined') return { month: currentMonth(), chars: 0 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { month: currentMonth(), chars: 0 }
    const data = JSON.parse(raw) as UsageData
    // Reset if month has changed
    if (data.month !== currentMonth()) {
      return { month: currentMonth(), chars: 0 }
    }
    return data
  } catch {
    return { month: currentMonth(), chars: 0 }
  }
}

function saveUsage(data: UsageData) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getUsage(): {
  chars: number
  limit: number
  remaining: number
} {
  const data = loadUsage()
  return {
    chars: data.chars,
    limit: ELEVENLABS_MONTHLY_LIMIT,
    remaining: Math.max(0, ELEVENLABS_MONTHLY_LIMIT - data.chars)
  }
}

export function addUsage(chars: number) {
  const data = loadUsage()
  data.chars += chars
  saveUsage(data)
}

export function isQuotaExhausted(): boolean {
  return getUsage().remaining <= 0
}

export function isQuotaWarning(): boolean {
  const { remaining, limit } = getUsage()
  return remaining > 0 && remaining < limit * 0.2 // Warn at <20% remaining
}
