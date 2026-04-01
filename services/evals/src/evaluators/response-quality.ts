import { openai } from '@ai-sdk/openai'
import { asEvaluator } from '@arizeai/phoenix-client/experiments'
import { generateText } from 'ai'

import { config } from '../config'

/**
 * Response quality evaluator — overall assessment of whether
 * the assistant's answer is helpful, complete, and well-structured.
 *
 * This is a higher-level eval than faithfulness — it checks not just
 * whether claims are grounded, but whether the response actually
 * answers the user's question in a useful way.
 */
export const responseQualityEvaluator = asEvaluator({
  name: 'response_quality',
  kind: 'LLM',
  evaluate: async ({ input, output }) => {
    const query = input.query as string
    const context = input.context as string
    const answer = output as string

    if (!answer) {
      return {
        score: 0.0,
        label: 'no_answer',
        metadata: {},
        explanation: 'No answer generated'
      }
    }

    const { text } = await generateText({
      model: openai(config.judgeModel),
      prompt: `You are an evaluator assessing the overall quality of an AI research assistant's response.

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

<thinking>`,
      maxOutputTokens: 400
    })

    const verdict = extractVerdict(text, ['excellent', 'good', 'poor'])
    const score = verdict === 'excellent' ? 1.0 : verdict === 'good' ? 0.7 : 0.0

    return {
      score,
      label: verdict,
      metadata: {},
      explanation: text.split('</thinking>')[0]?.trim() ?? null
    }
  }
})

function extractVerdict(text: string, options: string[]): string {
  const lower = text.toLowerCase()
  const afterThinking = lower.split('</thinking>').pop() ?? lower
  for (const option of options) {
    if (afterThinking.includes(option)) return option
  }
  for (const option of options) {
    if (lower.includes(option)) return option
  }
  return 'unknown'
}
