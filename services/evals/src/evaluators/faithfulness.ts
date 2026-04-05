import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'
import { createFaithfulnessEvaluator } from '@arizeai/phoenix-evals'
import type { LanguageModel } from 'ai'

import { inputField, normalizeEvalRunResult } from '../eval-output'

export function createFaithfulnessExperimentEvaluator(model: LanguageModel) {
  const evaluator = createFaithfulnessEvaluator({ model })

  return asExperimentEvaluator({
    name: 'faithfulness',
    kind: 'LLM',
    evaluate: async ({ input, output }) => {
      const context = inputField(input, 'context')
      const answer = normalizeEvalRunResult(output).answerText

      if (!context || !answer) {
        return {
          label: 'skipped',
          score: null,
          explanation: 'Missing context or answer'
        }
      }

      return evaluator.evaluate({
        input: inputField(input, 'query'),
        context,
        output: answer
      })
    }
  })
}
