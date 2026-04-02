import { createLLMEvaluator } from './create-evaluator'

/**
 * Search relevance evaluator — checks whether the search results
 * retrieved for a query are actually relevant to answering it.
 *
 * This evaluates the retrieval quality, not the generation quality.
 * Poor retrieval is the most common root cause of bad answers.
 */
export const relevanceEvaluator = createLLMEvaluator({
  name: 'search_relevance',
  verdicts: ['highly_relevant', 'partially_relevant', 'not_relevant'] as const,
  scoreMap: {
    highly_relevant: 1.0,
    partially_relevant: 0.5,
    not_relevant: 0.0
  },
  skipWhen: ({ context }) =>
    !context
      ? {
          label: 'no_results',
          score: 0.0,
          explanation: 'No search results returned'
        }
      : null,
  prompt: ({ query, context }) =>
    `You are an evaluator assessing whether search results are relevant to a user's query.

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

<thinking>`
})
