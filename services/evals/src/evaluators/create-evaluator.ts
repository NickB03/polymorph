import { openai } from '@ai-sdk/openai'
import { asEvaluator } from '@arizeai/phoenix-client/experiments'
import { generateText } from 'ai'

import { config } from '../config'

import { asString, extractExplanation, extractVerdict } from './extract-verdict'

interface EvaluatorConfig<V extends string> {
  name: string
  /** Build the prompt from extracted inputs */
  prompt: (inputs: { query: string; context: string; answer: string }) => string
  verdicts: readonly V[]
  scoreMap: Partial<Record<V, number>>
  /** Return a skip result label if inputs are insufficient, or null to proceed */
  skipWhen?: (inputs: {
    query: string
    context: string
    answer: string
  }) => { label: string; score: number | null; explanation: string } | null
  maxOutputTokens?: number
}

/**
 * Factory for LLM-judge evaluators that share the same structure:
 * extract inputs → skip check → generateText → extractVerdict → score.
 */
export function createLLMEvaluator<V extends string>(cfg: EvaluatorConfig<V>) {
  return asEvaluator({
    name: cfg.name,
    kind: 'LLM',
    evaluate: async ({ input, output }) => {
      const query = asString(input.query)
      const context = asString(input.context)
      const answer = asString(output)

      const skip = cfg.skipWhen?.({ query, context, answer })
      if (skip) {
        return { ...skip, metadata: {} }
      }

      const { text } = await generateText({
        model: openai(config.judgeModel),
        prompt: cfg.prompt({ query, context, answer }),
        maxOutputTokens: cfg.maxOutputTokens ?? 400
      })

      const verdict = extractVerdict(text, cfg.verdicts)
      const score = verdict === 'unknown' ? 0.0 : (cfg.scoreMap[verdict] ?? 0.0)

      return {
        score,
        label: verdict,
        metadata: {},
        explanation: extractExplanation(text)
      }
    }
  })
}
