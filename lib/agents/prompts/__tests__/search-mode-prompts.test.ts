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
