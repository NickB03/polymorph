import { createLLMEvaluator } from './create-evaluator'

/**
 * Faithfulness evaluator — checks whether the model's answer
 * is grounded in the search results (retrieved context).
 *
 * A response is "faithful" if every factual claim is supported by
 * the provided search context.
 */
export const faithfulnessEvaluator = createLLMEvaluator({
  name: 'faithfulness',
  verdicts: ['faithful', 'partial', 'unfaithful'] as const,
  scoreMap: { faithful: 1.0, partial: 0.5, unfaithful: 0.0 },
  maxOutputTokens: 500,
  skipWhen: ({ context, answer }) =>
    !context || !answer
      ? {
          label: 'skipped',
          score: null,
          explanation: 'Missing context or answer'
        }
      : null,
  prompt: ({ query, context, answer }) =>
    `You are an evaluator assessing whether an AI assistant's answer is faithful to the provided search context.

<question>${query}</question>

<search_context>
${context}
</search_context>

<answer>${answer}</answer>

Evaluate faithfulness:
- "faithful": Every factual claim in the answer is supported by the search context
- "unfaithful": The answer contains claims not supported by or contradicting the search context
- "partial": Some claims are supported, but others are not

First, briefly explain your reasoning in <thinking> tags.
Then give your verdict as exactly one of: faithful, partial, unfaithful

<thinking>`
})
