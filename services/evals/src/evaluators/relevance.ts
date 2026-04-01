import { openai } from '@ai-sdk/openai'
import { asEvaluator } from '@arizeai/phoenix-client/experiments'
import { generateText } from 'ai'

import { config } from '../config'

import { asString, extractVerdict } from './extract-verdict'

/**
 * Search relevance evaluator — checks whether the search results
 * retrieved for a query are actually relevant to answering it.
 *
 * This evaluates the retrieval quality, not the generation quality.
 * Poor retrieval is the most common root cause of bad answers.
 */
export const relevanceEvaluator = asEvaluator({
  name: 'search_relevance',
  kind: 'LLM',
  evaluate: async ({ input }) => {
    const query = asString(input.query)
    const context = asString(input.context)

    if (!context) {
      return {
        score: 0.0,
        label: 'no_results',
        metadata: {},
        explanation: 'No search results returned'
      }
    }

    const { text } = await generateText({
      model: openai(config.judgeModel),
      prompt: `You are an evaluator assessing whether search results are relevant to a user's query.

<query>${query}</query>

<search_results>
${context}
</search_results>

Rate the relevance of these search results to the query:
- "highly_relevant": Results directly address the query with useful, on-topic information
- "partially_relevant": Some results are useful but others are off-topic or tangential
- "not_relevant": Results do not meaningfully help answer the query

First, briefly explain your reasoning in <thinking> tags.
Then give your verdict as exactly one of: highly_relevant, partially_relevant, not_relevant

<thinking>`,
      maxOutputTokens: 400
    })

    const verdict = extractVerdict(text, [
      'highly_relevant',
      'partially_relevant',
      'not_relevant'
    ])
    const score =
      verdict === 'highly_relevant'
        ? 1.0
        : verdict === 'partially_relevant'
          ? 0.5
          : 0.0

    return {
      score,
      label: verdict,
      metadata: {},
      explanation: text.split('</thinking>')[0]?.trim() ?? null
    }
  }
})
