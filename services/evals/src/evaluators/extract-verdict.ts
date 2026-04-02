/**
 * Extract a verdict keyword from LLM judge output.
 * Looks first after </thinking> tags, then falls back to full text.
 */
export function extractVerdict<T extends string>(
  text: string,
  options: readonly T[]
): T | 'unknown' {
  const lower = text.toLowerCase()
  const afterThinking = lower.split('</thinking>').pop() ?? lower
  for (const option of options) {
    if (matchesWord(afterThinking, option)) return option
  }
  for (const option of options) {
    if (matchesWord(lower, option)) return option
  }
  return 'unknown'
}

function matchesWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(text)
}

/**
 * Extract the explanation from LLM judge output that uses <thinking> tags.
 * Returns the content before </thinking>, trimmed.
 */
export function extractExplanation(text: string): string | null {
  return text.split('</thinking>')[0]?.trim() ?? null
}

export function asString(value: unknown): string {
  if (value == null) return ''
  return typeof value === 'string' ? value : String(value)
}
