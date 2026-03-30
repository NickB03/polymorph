import { describe, expect, it } from 'vitest'

import { getChatModePrompt, getResearchModePrompt } from './search-mode-prompts'

describe('search mode prompts', () => {
  const sharedCanvasAssertions = [
    'CANVAS ARTIFACTS (interactive web apps):',
    'Plan before you write code',
    'Think through the user flow and state model before calling the tool.',
    'Use the repo defaults: organic minimalism, Geist, OKLCH, blue accent family',
    'Do not use placeholder text like Lorem ipsum',
    'Use `window.__CANVAS_IMAGE_BASE__` when you need generated or thumbnail images',
    'Only one canvas artifact per chat',
    '**Allowed packages:** `react`, `react-dom/client`, `lucide-react` (icons), `recharts` (charts), `motion/react` (animation), `date-fns` (date utilities)',
    '**Icons:** Use `lucide-react` for all icons',
    'Normal build/create requests skip search entirely',
    'Modify/update requests skip search entirely',
    'Research-then-build requests search first, then build',
    'Factual or current-data artifact requests do a short search phase first, then build'
  ] as const

  function expectSharedCanvasRules(prompt: string) {
    for (const assertion of sharedCanvasAssertions) {
      expect(prompt).toContain(assertion)
    }
  }

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

  it('shares the canvas artifact guidance in chat mode', () => {
    expectSharedCanvasRules(getChatModePrompt())
  })

  it('shares the canvas artifact guidance in research mode', () => {
    expectSharedCanvasRules(getResearchModePrompt())
  })

  it('keeps the one artifact per chat rule intact', () => {
    expect(getChatModePrompt()).toContain('Only one canvas artifact per chat')
    expect(getResearchModePrompt()).toContain(
      'Only one canvas artifact per chat'
    )
  })

  it('keeps the allowed file and import constraints intact', () => {
    expect(getChatModePrompt()).toContain(
      '**Allowed packages:** `react`, `react-dom/client`, `lucide-react` (icons), `recharts` (charts), `motion/react` (animation), `date-fns` (date utilities)'
    )
    expect(getResearchModePrompt()).toContain(
      '**Allowed packages:** `react`, `react-dom/client`, `lucide-react` (icons), `recharts` (charts), `motion/react` (animation), `date-fns` (date utilities)'
    )
  })
})
