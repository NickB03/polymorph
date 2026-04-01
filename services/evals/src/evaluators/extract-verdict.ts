/**
 * Extract a verdict keyword from LLM judge output.
 * Looks first after </thinking> tags, then falls back to full text.
 */
export function extractVerdict(text: string, options: string[]): string {
  const lower = text.toLowerCase()
  const afterThinking = lower.split('</thinking>').pop() ?? lower
  for (const option of options) {
    if (afterThinking.includes(option)) return option
  }
  for (const option of options) {
    if (lower.includes(option)) return option
  }
  return 'unknown'
}

/**
 * Safely coerce an evaluator input/output to string.
 * Returns empty string for nullish values, calls String() on non-strings.
 */
export function asString(value: unknown): string {
  if (value == null) return ''
  return typeof value === 'string' ? value : String(value)
}
