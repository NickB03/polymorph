import { createLLMEvaluator } from './create-evaluator'

/**
 * Response quality evaluator — overall assessment of whether
 * the assistant's answer is helpful, complete, and well-structured.
 *
 * This is a higher-level eval than faithfulness — it checks not just
 * whether claims are grounded, but whether the response actually
 * answers the user's question in a useful way.
 */
export const responseQualityEvaluator = createLLMEvaluator({
  name: 'response_quality',
  verdicts: ['excellent', 'good', 'poor'] as const,
  scoreMap: { excellent: 1.0, good: 0.7, poor: 0.0 },
  skipWhen: ({ answer }) =>
    !answer
      ? { label: 'no_answer', score: 0.0, explanation: 'No answer generated' }
      : null,
  prompt: ({ query, context, answer }) =>
    `You are an evaluator assessing the overall quality of an AI research assistant's response.

<question>${query}</question>

${context ? `<search_context>\n${context}\n</search_context>\n` : ''}
<answer>${answer}</answer>

Rate the response quality on these criteria:
1. Does it directly answer the user's question?
2. Is it well-organized and easy to read?
3. Does it provide sufficient depth without unnecessary padding?
4. Does it use the available context effectively?

Give a rating:
- "excellent": Comprehensive, well-structured, directly answers the question
- "good": Adequately answers the question with minor issues
- "poor": Fails to answer the question, is confusing, or has significant issues

First, briefly explain your reasoning in <thinking> tags.
Then give your verdict as exactly one of: excellent, good, poor

<thinking>`
})
