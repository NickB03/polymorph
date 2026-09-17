import { describe, expect, it } from 'vitest'

import { needsReasoningStrip } from '../strip-reasoning-parts'

describe('needsReasoningStrip', () => {
  it('strips for OpenAI and DeepSeek-via-OpenRouter models', () => {
    expect(needsReasoningStrip('openai:gpt-4.1')).toBe(true)
    expect(needsReasoningStrip('openrouter:deepseek/deepseek-v4-pro')).toBe(
      true
    )
  })

  it('leaves reasoning intact for every other model', () => {
    expect(needsReasoningStrip('gateway:google/gemini-3-flash')).toBe(false)
    expect(needsReasoningStrip('openrouter:anthropic/claude-sonnet-4')).toBe(
      false
    )
  })
})
