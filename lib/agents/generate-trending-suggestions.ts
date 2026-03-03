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
You will be given a list of current trending news headlines and snippets.
Create 4 prompt suggestions per category that reference SPECIFIC trending topics from the context provided.

Categories and their style:
- research: Deep-dive questions starting with "Why", "How", "What are the implications of..."
- compare: Head-to-head comparisons using "vs" or "comparison" related to trending topics
- latest: News-oriented prompts like "Latest on...", "What happened with..."
- summarize: Summarization requests like "Summarize the...", "Key takeaways from..."
- explain: Explainer prompts like "Explain...", "How does... work?", "What is..."

Rules:
- Each prompt must be concise (under 60 characters when possible)
- Reference specific people, companies, events, or technologies from the trending context
- Make prompts feel timely and relevant to today
- Do NOT use generic/evergreen prompts — they must be tied to current events`

/**
 * Fetches trending topics via Tavily and uses Gemini Flash to generate
 * categorized prompt suggestions. Falls back to static defaults on any error.
 */
export async function generateTrendingSuggestions(): Promise<
  Record<string, string[]>
> {
  try {
    const tavily = new TavilySearchProvider()
    const searchResults = await tavily.search(
      'trending news and topics today',
      15,
      'basic'
    )

    const context = searchResults.results
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
      prompt: `Here are today's trending topics:\n\n${context}\n\nGenerate category-appropriate prompt suggestions based on these trending topics.`
    })

    return object
  } catch (error) {
    console.error('Failed to generate trending suggestions:', error)
    return DEFAULT_SUGGESTIONS
  }
}
