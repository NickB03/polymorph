import type { SuggestionCategory } from '@/lib/types'

/**
 * Curated prompt pool for the ActionButtons home-page suggestion pills.
 *
 * The GET /api/suggestions route draws from this pool using a day-of-epoch
 * seed so suggestions rotate daily without any API calls. When the
 * scheduled refresh job has populated `trending:suggestions:dynamic`, the
 * route blends dynamic items into `latest` on top of this pool.
 */
export const SUGGESTION_POOL: Record<SuggestionCategory, string[]> = {
  research: [
    'Why is antibiotic resistance accelerating?',
    'How does sleep deprivation affect memory?',
    'What drives inflation in housing markets?',
    'Why has nuclear fusion taken decades to commercialize?',
    'How does chronic stress reshape the brain?',
    'What are the long-term effects of microplastic exposure?',
    'How does gut microbiome affect mood?',
    'What causes long COVID symptoms to persist?',
    'Why do civilizations collapse?',
    'How does ocean temperature influence hurricane intensity?',
    'Why do some memories fade faster than others?',
    'How does loneliness affect physical health?',
    'What drives the rise of autoimmune disease?',
    'Why are songbird populations declining globally?',
    'How does urban density shape mental health?',
    'What makes certain diseases zoonotic?'
  ],
  compare: [
    'Nuclear vs solar for baseload power',
    'Passive vs active investing strategies',
    'Electric vs hydrogen fuel cell vehicles',
    'Public vs private space exploration programs',
    'Remote vs in-office productivity',
    'Plant-based vs cultivated meat',
    'Mediterranean vs ketogenic diet',
    'iOS vs Android ecosystem tradeoffs',
    'Open source vs proprietary AI models',
    'Renting vs buying in high-cost cities',
    'Gas vs heat pump home heating',
    'Traditional vs Roth retirement accounts',
    'Meditation vs therapy for anxiety',
    'React vs Svelte for modern web apps',
    'Ultrasound vs MRI imaging tradeoffs',
    'CRISPR vs traditional gene therapy'
  ],
  latest: [
    'Recent Claude and GPT benchmark shifts',
    'Webb update on asteroid 2024 YR4',
    'Malaria vaccine rollout across 25 countries',
    'Recent Moderna mRNA cancer vaccine trial results',
    'Latest fusion energy milestones at Commonwealth Fusion',
    'Waymo robotaxi rollout across 10 U.S. markets',
    'Current state of Waymo autonomous rollout',
    'Recent breakthroughs in CRISPR gene editing trials',
    'Nvidia H20 export controls latest',
    'How the SpaceX Starship fleet is performing',
    'Latest bird flu outbreak status in US dairy cattle',
    'State of quantum computing milestones in 2026',
    'AI chip smuggling case tied to China',
    'Current AI chip export control enforcement',
    'Gulf hurricane forecast for the 2026 season',
    'U.S. measles outbreak update in 2026'
  ],
  summarize: [
    'Summarize the key findings on neural scaling laws',
    'Key takeaways from recent climate reports',
    'Summarize the state of global chip manufacturing',
    'Create an executive summary of AI trends',
    'Summarize the mental health crisis in Gen Z',
    'Key findings from recent Alzheimer’s drug trials',
    'Summarize the push for small modular reactors',
    'Overview of battery tech roadmaps through 2030',
    'Summarize the economics of the streaming wars',
    'Key takeaways from the latest IPCC report',
    'Summarize remote work’s impact five years on',
    'Overview of commercial space station timelines',
    'Summarize the AI chip startup landscape',
    'Key findings on psychedelics for PTSD treatment',
    'Overview of modern monetary theory debates',
    'Summarize the economics of print journalism decline'
  ],
  explain: [
    'Explain how mRNA vaccines work',
    'What causes ocean acidification?',
    'How does the placebo effect work?',
    'Explain how large language models are trained',
    'How do transformer neural networks work?',
    'What causes auroras in polar regions?',
    'Explain how insurance actuaries calculate risk',
    'How does compound interest build wealth?',
    'What makes sourdough starters work?',
    'Explain how fiber optic cables transmit data',
    'How do quantum computers solve problems differently?',
    'What causes the seasons on Earth?',
    'Explain how carbon capture technology works',
    'How does active noise cancellation work?',
    'What is the Krebs cycle and why does it matter?',
    'Explain how vaccines train the immune system'
  ]
}

/** Integer day-of-epoch — changes once per UTC day. */
export function dayOfEpoch(now: number = Date.now()): number {
  return Math.floor(now / 86_400_000)
}

// Deterministic LCG so a given seed always yields the same rotation across
// every server instance and every edge cache.
function seededRandom(seed: number): () => number {
  let state = seed || 1
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

function shuffleWithSeed<T>(arr: readonly T[], seed: number): T[] {
  const result = [...arr]
  const random = seededRandom(seed)
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Offset each category's seed so rotations don't move in lockstep.
const CATEGORY_SEED_OFFSETS: Record<SuggestionCategory, number> = {
  research: 0,
  compare: 1,
  latest: 2,
  summarize: 3,
  explain: 4
}

export function selectDailySuggestionsFromPool(
  dayIndex: number,
  count: number = 4
): Record<SuggestionCategory, string[]> {
  const categories = Object.keys(CATEGORY_SEED_OFFSETS) as SuggestionCategory[]
  const out = {} as Record<SuggestionCategory, string[]>
  for (const category of categories) {
    const seed = dayIndex * 5 + CATEGORY_SEED_OFFSETS[category]
    out[category] = shuffleWithSeed(SUGGESTION_POOL[category], seed).slice(
      0,
      count
    )
  }
  return out
}

/**
 * Legacy export — kept for the client hook and any other callers that
 * want a sensible static value without computing a rotation themselves.
 * Resolves once at module-load time (acceptable for a client-side
 * initial-state fallback).
 */
export const DEFAULT_SUGGESTIONS: Record<SuggestionCategory, string[]> =
  selectDailySuggestionsFromPool(dayOfEpoch())
