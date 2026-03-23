import { describe, expect, it } from 'vitest'

import { getChatModePrompt, getResearchModePrompt } from './search-mode-prompts'

describe('search mode prompts', () => {
  it('keeps displayPlan-only list formatting guidance out of research mode', () => {
    const prompt = getResearchModePrompt()

    expect(prompt).not.toContain(
      'NO numbered step lists — call displayPlan instead'
    )
  })

  it('retains displayPlan guidance in chat mode', () => {
    const prompt = getChatModePrompt()

    expect(prompt).toContain(
      'NO numbered step lists — call displayPlan instead'
    )
  })
})
