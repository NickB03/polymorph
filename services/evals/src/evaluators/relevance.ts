import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'
import { createDocumentRelevanceEvaluator } from '@arizeai/phoenix-evals'
import type { LanguageModel } from 'ai'

export function createRelevanceExperimentEvaluator(model: LanguageModel) {
  const evaluator = createDocumentRelevanceEvaluator({ model })

  return asExperimentEvaluator({
    name: 'search_relevance',
    kind: 'LLM',
    evaluate: async ({ input }) => {
      const context = String((input as Record<string, unknown>).context ?? '')

      if (!context) {
        return {
          label: 'no_results',
          score: 0.0,
          explanation: 'No search results returned'
        }
      }

      return evaluator.evaluate({
        input: String((input as Record<string, unknown>).query ?? ''),
        documentText: context
      })
    }
  })
}
