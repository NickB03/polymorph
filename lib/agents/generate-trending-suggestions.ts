import { generateObject } from 'ai'
import { z } from 'zod'

import { getRelatedQuestionsModel } from '@/lib/config/model-types'
import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'
import { TavilySearchProvider } from '@/lib/tools/search/providers/tavily'
import { getModel } from '@/lib/utils/registry'

const trendingSuggestionsSchema = z.object({
  research: z.array(z.string()).length(4),
  compare: z.array(z.string()).length(4),
  latest: z.array(z.string()).length(4),
  summarize: z.array(z.string()).length(4),
  explain: z.array(z.string()).length(4)
})

const SYSTEM_PROMPT = `You generate trending search prompt suggestions for an AI answer engine.
You will be given trending topics across science, technology, business, health, culture, and more.
Create 4 prompt suggestions per category. Use the trending context for inspiration but prioritize DOMAIN DIVERSITY over news recency.

Categories and their style:
- research: Academic deep-dive questions about medicine, psychology, economics, climate science, physics, or sociology. Start with "Why", "How", "What drives", "What are the implications of". Example: "Why is antibiotic resistance accelerating?", "How does sleep deprivation affect memory formation?"
- compare: Head-to-head comparisons using "vs" or "Compare". Include at least 2 non-tech comparisons. Example: "Nuclear vs solar for baseload power", "Compare public vs private space programs"
- latest: Current events and recent developments. This is the ONLY category for news headlines. Require domain mix — not all political. Example: "Latest breakthroughs in AI research", "What happened in space exploration this week?"
- summarize: Summarization requests spanning business, science, culture. Example: "Summarize the state of global chip manufacturing", "Key takeaways from recent climate reports"
- explain: Concept explainers — NOT news. Focus on science, economics, technology, and cultural phenomena. Example: "Explain how mRNA vaccines work", "What causes ocean acidification?", "How does the placebo effect work?"

Rules:
- Each prompt must be concise (under 60 characters when possible)
- Reference specific topics, technologies, or phenomena from the trending context when relevant
- DOMAIN DIVERSITY is mandatory: across all 20 suggestions, cover 6+ distinct domains (science, tech, health, business, space, environment, psychology, sports, culture, economics, etc.)
- POLITICAL CAP: at most 2 of the 20 suggestions may be political, and they must be in the "latest" category only
- "research" and "explain" must NEVER contain political prompts
- Prefer evergreen-feeling prompts inspired by trends over ephemeral headline references`

/**
 * Fetches trending topics via Tavily and uses Gemini Flash to generate
 * categorized prompt suggestions. Falls back to static defaults on any error.
 */
export async function generateTrendingSuggestions(): Promise<
  Record<string, string[]>
> {
  try {
    const tavily = new TavilySearchProvider()
    const queries = [
      'trending science technology breakthroughs this week',
      'trending business economy culture sports this week',
      'trending health environment space discoveries this week'
    ]

    const searchResults = await Promise.all(
      queries.map(q => tavily.search(q, 5, 'basic'))
    )

    const context = searchResults
      .flatMap(r => r.results)
      .map(r => `- ${r.title}: ${r.content}`)
      .join('\n')

    if (!context.trim()) {
      return DEFAULT_SUGGESTIONS
    }

    const relatedModel = getRelatedQuestionsModel()
    const modelId = `${relatedModel.providerId}:${relatedModel.id}`

    const { object } = await generateObject({
      model: getModel(modelId),
      schema: trendingSuggestionsSchema,
      system: SYSTEM_PROMPT,
      prompt: `Here are today's trending topics across various domains:\n\n${context}\n\nGenerate diverse, category-appropriate prompt suggestions. Ensure broad domain coverage and limit political content.`
    })

    return object
  } catch (error) {
    console.error('Failed to generate trending suggestions:', error)
    return DEFAULT_SUGGESTIONS
  }
}
