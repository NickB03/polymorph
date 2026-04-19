import { generateObject } from 'ai'
import { z } from 'zod'

import { getTrendingSuggestionsModel } from '@/lib/config/model-types'
import { TavilySearchProvider } from '@/lib/tools/search/providers/tavily'
import type { SuggestionCategory } from '@/lib/types'
import { createModelId } from '@/lib/utils'
import { getModel } from '@/lib/utils/registry'

const trendingSuggestionsSchema = z.object({
  research: z.array(z.string()).length(4),
  compare: z.array(z.string()).length(4),
  latest: z.array(z.string()).length(4),
  summarize: z.array(z.string()).length(4),
  explain: z.array(z.string()).length(4)
})

const SYSTEM_PROMPT = `You generate trending search prompt suggestions for an AI search platform.
You will be given trending topics across science, technology, business, health, culture, and more.
Create 4 prompt suggestions per category. Use the trending context for inspiration but prioritize DOMAIN DIVERSITY over news recency.

Categories and their style:
- research: Academic deep-dive questions about medicine, psychology, economics, climate science, physics, or sociology. Start with "Why", "How", "What drives", "What are the implications of". Example: "Why is antibiotic resistance accelerating?", "How does sleep deprivation affect memory formation?"
- compare: Head-to-head comparisons using "vs" or "Compare". Include at least 2 non-tech comparisons. Example: "Nuclear vs solar for baseload power", "Compare public vs private space programs"
- latest: Specific, topical news stories happening RIGHT NOW. Reference actual events, names, or developments from the trending context — never use vague phrases like "latest breakthroughs in X" or "what happened in X this week". Require domain mix — not all political. Example: "What caused the Ohio train chemical spill?", "Why did Silicon Valley Bank collapse?"
- summarize: Summarization requests spanning business, science, culture. Example: "Summarize the state of global chip manufacturing", "Key takeaways from recent climate reports"
- explain: Concept explainers — NOT news. Focus on science, economics, technology, and cultural phenomena. Example: "Explain how mRNA vaccines work", "What causes ocean acidification?", "How does the placebo effect work?"

Rules:
- Each prompt must be concise (under 60 characters when possible)
- Reference specific topics, technologies, or phenomena from the trending context when relevant
- DOMAIN DIVERSITY is mandatory: across all 20 suggestions, cover 6+ distinct domains (science, tech, health, business, space, environment, psychology, sports, culture, economics, etc.)
- POLITICAL CAP: at most 2 of the 20 suggestions may be political, and they must be in the "latest" category only
- "research" and "explain" must NEVER contain political prompts
- For research, compare, summarize, and explain: prefer evergreen-feeling prompts inspired by trends over ephemeral headline references
- For latest: do the OPPOSITE — use specific, timely references to actual events from the trending context. Never be vague or generic in this category.`

const TRENDING_QUERY =
  'top trending news today across science technology health business culture space'

export type TrendingSuggestionsResult = {
  suggestions: Record<SuggestionCategory, string[]>
}

async function getTrendingContext(): Promise<string> {
  const tavily = new TavilySearchProvider()
  const { results } = await tavily.search(TRENDING_QUERY, 5, 'basic', [], [], {
    includeImages: false
  })

  const seen = new Set<string>()
  return results
    .filter(result => {
      const key = result.url ?? `${result.title ?? ''}:${result.content ?? ''}`
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map(result => {
      const title = result.title ?? 'Untitled'
      const content = result.content ?? ''
      return `- ${title}: ${content}`
    })
    .join('\n')
}

/**
 * Background refresh for the suggestion pills. Issues exactly one Tavily
 * search and one LLM call. Intended to be invoked by the daily cron at
 * `/api/suggestions/refresh` only — NOT by any user-facing request path.
 *
 * Throws on failure so the cron handler can surface the error in logs /
 * status codes. Does not fall back to static defaults; the read path
 * already handles a missing dynamic key by serving the rotated static
 * pool.
 */
export async function generateTrendingSuggestions(): Promise<TrendingSuggestionsResult> {
  const context = await getTrendingContext()

  if (!context.trim()) {
    throw new Error('Tavily returned no usable results for trending context')
  }

  const suggestionsModel = getTrendingSuggestionsModel()
  const modelId = createModelId(suggestionsModel)

  const { object } = await generateObject({
    model: getModel(modelId),
    schema: trendingSuggestionsSchema,
    system: SYSTEM_PROMPT,
    prompt: `Here are today's trending topics across various domains:\n\n${context}\n\nGenerate diverse, category-appropriate prompt suggestions. Ensure broad domain coverage and limit political content.`
  })

  return { suggestions: object }
}
