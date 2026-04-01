import { openai } from '@ai-sdk/openai'
import { asEvaluator } from '@arizeai/phoenix-client/experiments'
import { generateText } from 'ai'

import { config } from '../config'

import { asString, extractVerdict } from './extract-verdict'

/**
 * Faithfulness evaluator — checks whether the model's answer
 * is grounded in the search results (retrieved context).
 *
 * Uses an LLM judge to classify each response as faithful or unfaithful.
 * A response is "faithful" if every factual claim is supported by
 * the provided search context.
 */
export const faithfulnessEvaluator = asEvaluator({
  name: 'faithfulness',
  kind: 'LLM',
  evaluate: async ({ input, output }) => {
    const query = asString(input.query)
    const context = asString(input.context)
    const answer = asString(output)

    if (!context || !answer) {
      return {
        score: null,
        label: 'skipped',
        metadata: {},
        explanation: 'Missing context or answer'
      }
    }

    const { text } = await generateText({
      model: openai(config.judgeModel),
      prompt: `You are an evaluator assessing whether an AI assistant's answer is faithful to the provided search context.

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

<thinking>`,
      maxOutputTokens: 500
    })

    const verdict = extractVerdict(text, ['faithful', 'partial', 'unfaithful'])
    const score =
      verdict === 'faithful' ? 1.0 : verdict === 'partial' ? 0.5 : 0.0

    return {
      score,
      label: verdict,
      metadata: {},
      explanation: text.split('</thinking>')[0]?.trim() ?? null
    }
  }
})
