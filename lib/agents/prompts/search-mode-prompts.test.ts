import { describe, expect, it } from 'vitest'

import { CHAT_MODE_PROMPT, RESEARCH_MODE_PROMPT } from './search-mode-prompts'

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
    expect(RESEARCH_MODE_PROMPT).not.toContain(
      'NO numbered step lists — call displayPlan instead'
    )
  })

  it('retains displayPlan guidance in chat mode', () => {
    expect(CHAT_MODE_PROMPT).toContain(
      'NO numbered step lists for how-to content — call displayPlan instead'
    )
  })

  it('shares the canvas artifact guidance in chat mode', () => {
    expectSharedCanvasRules(CHAT_MODE_PROMPT)
  })

  it('shares the canvas artifact guidance in research mode', () => {
    expectSharedCanvasRules(RESEARCH_MODE_PROMPT)
  })

  it('keeps the one artifact per chat rule intact', () => {
    expect(CHAT_MODE_PROMPT).toContain('Only one canvas artifact per chat')
    expect(RESEARCH_MODE_PROMPT).toContain('Only one canvas artifact per chat')
  })

  it('keeps the allowed file and import constraints intact', () => {
    expect(CHAT_MODE_PROMPT).toContain(
      '**Allowed packages:** `react`, `react-dom/client`, `lucide-react` (icons), `recharts` (charts), `motion/react` (animation), `date-fns` (date utilities)'
    )
    expect(RESEARCH_MODE_PROMPT).toContain(
      '**Allowed packages:** `react`, `react-dom/client`, `lucide-react` (icons), `recharts` (charts), `motion/react` (animation), `date-fns` (date utilities)'
    )
  })

  it.each([
    ['chat', CHAT_MODE_PROMPT],
    ['research', RESEARCH_MODE_PROMPT]
  ])(
    '%s prompt forbids pseudo display tool placeholders and requires prose fallback',
    (_mode, prompt) => {
      expect(prompt).toContain('Never write pseudo-tool text such as')
      expect(prompt).toContain('displayTimeline(...)')
      expect(prompt).toContain('If you cannot make a real display tool call')
      expect(prompt).toContain('continue with normal prose')
    }
  )
})

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

describe('Issue 2 — displayGeoMap placement for location-centric queries', () => {
  it('CHAT_MODE_PROMPT tells model to render map early for location queries', () => {
    expect(CHAT_MODE_PROMPT).toContain('PLACEMENT (location-centric queries)')
    expect(CHAT_MODE_PROMPT).toContain('render the map EARLY')
    expect(CHAT_MODE_PROMPT).toContain(
      'Supporting tables and prose go AFTER the map, not before'
    )
  })

  it('RESEARCH_MODE_PROMPT has the same placement rule', () => {
    expect(RESEARCH_MODE_PROMPT).toContain(
      'PLACEMENT (location-centric queries)'
    )
    expect(RESEARCH_MODE_PROMPT).toContain('render the map EARLY')
    expect(RESEARCH_MODE_PROMPT).toContain(
      'Supporting tables and prose go AFTER the map, not before'
    )
  })
})

describe('Issue 3 — displayTable link guidance', () => {
  it('CHAT_MODE_PROMPT teaches the link format with a worked example', () => {
    expect(CHAT_MODE_PROMPT).toContain('LINK ENTITY CELLS')
    expect(CHAT_MODE_PROMPT).toContain(
      'format: { kind: "link", hrefKey: "url", external: true }'
    )
    expect(CHAT_MODE_PROMPT).toContain('martial-arts-schools')
    expect(CHAT_MODE_PROMPT).toContain('hidden: true')
  })

  it('RESEARCH_MODE_PROMPT teaches the link format with a worked example', () => {
    expect(RESEARCH_MODE_PROMPT).toContain('LINK ENTITY CELLS')
    expect(RESEARCH_MODE_PROMPT).toContain(
      'format: { kind: "link", hrefKey: "url", external: true }'
    )
    expect(RESEARCH_MODE_PROMPT).toContain('martial-arts-schools')
    expect(RESEARCH_MODE_PROMPT).toContain('hidden: true')
  })
})

describe('Issue 4 — follow-up context handling', () => {
  const DISTINCT_PHRASES = [
    'FOLLOW-UP CONTEXT HANDLING',
    'Refinement signals',
    'do any of them',
    'REUSE prior tool results',
    'Do NOT re-emit the prior section heading',
    'Do NOT re-render the prior displayTable unless a column materially changed',
    'Do NOT re-render the prior displayGeoMap unless the marker set changed'
  ]

  for (const phrase of DISTINCT_PHRASES) {
    it(`CHAT_MODE_PROMPT contains follow-up rule phrase: "${phrase}"`, () => {
      expect(CHAT_MODE_PROMPT).toContain(phrase)
    })

    it(`RESEARCH_MODE_PROMPT contains follow-up rule phrase: "${phrase}"`, () => {
      expect(RESEARCH_MODE_PROMPT).toContain(phrase)
    })
  }
})
