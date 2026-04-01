/**
 * Extract a verdict keyword from LLM judge output.
 * Looks first after </thinking> tags, then falls back to full text.
 */
export function extractVerdict(text: string, options: string[]): string {
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
 * Safely coerce an evaluator input/output to string.
 * Returns empty string for nullish values, calls String() on non-strings.
 */
export function asString(value: unknown): string {
  if (value == null) return ''
  return typeof value === 'string' ? value : String(value)
}
