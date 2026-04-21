import { describe, expect, it } from 'vitest'

import {
  CHAT_MODE_PROMPT,
  RESEARCH_MODE_PROMPT
} from '@/lib/agents/prompts/search-mode-prompts'

// Prompt guidance blocks are large free-form strings that the researcher tests
// mock away. If one of these bullets is accidentally deleted, the tool is
// registered but the model has no guidance on when to call it — a silent
// regression. Anchor each new tier-2 tool's name in both prompts here.
const REQUIRED_TOOLS = [
  'displayGeoMap',
  'getDirections',
  'geocodeAddress',
  'getIsochrone',
  'getStaticMapImage'
] as const

describe('search-mode-prompts', () => {
  for (const name of REQUIRED_TOOLS) {
    it(`CHAT_MODE_PROMPT references ${name}`, () => {
      expect(CHAT_MODE_PROMPT).toContain(name)
    })

    it(`RESEARCH_MODE_PROMPT references ${name}`, () => {
      expect(RESEARCH_MODE_PROMPT).toContain(name)
    })
  }
})

describe('Issue 1 — displayPlan gating', () => {
  it('CHAT_MODE_PROMPT forbids fabricated "getting started" checklists', () => {
    expect(CHAT_MODE_PROMPT).toContain(
      'DO NOT invent a "getting started" or "next steps" checklist they did not ask for'
    )
    expect(CHAT_MODE_PROMPT).toContain('the recommendations ARE the answer')
  })

  it('CHAT_MODE_PROMPT restricts the "no numbered lists" rule to how-to content', () => {
    expect(CHAT_MODE_PROMPT).toContain(
      'NO numbered step lists for how-to content'
    )
    expect(CHAT_MODE_PROMPT).toContain(
      "only when the user's query matches the displayPlan TRIGGER above"
    )
  })

  it('RESEARCH_MODE_PROMPT blocks fabricated checklists on research answers', () => {
    expect(RESEARCH_MODE_PROMPT).toContain(
      'Never fabricate an unrequested "how to get started" or "next steps" checklist'
    )
    expect(RESEARCH_MODE_PROMPT).toContain(
      'the research findings ARE the answer'
    )
  })
})
