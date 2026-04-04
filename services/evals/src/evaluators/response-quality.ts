import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'
import { createClassificationEvaluator } from '@arizeai/phoenix-evals'
import type { LanguageModel } from 'ai'

import { normalizeEvalRunResult } from '../eval-output'

// Safe fallback template using simple {{var}} interpolation.
// An empty <search_context></search_context> block is benign for the LLM judge.
const PROMPT_TEMPLATE = `You are an evaluator assessing the overall quality of an AI research assistant's response.

<question>{{query}}</question>

<search_context>
{{context}}
</search_context>

<answer>{{answer}}</answer>

Evaluate the response on these criteria:
1. Does it directly answer the user's question?
2. Is it well-organized and easy to read?
3. Does it provide sufficient depth without unnecessary padding?
4. Does it use the available context effectively?

Classifications:
- "pass": The response satisfactorily addresses all criteria — it answers the question, is readable, has appropriate depth, and uses context well
- "fail": The response fails one or more criteria significantly — it misses the question, is confusing, lacks substance, or ignores available context`

export function createResponseQualityExperimentEvaluator(model: LanguageModel) {
  const evaluator = createClassificationEvaluator<{
    query: string
    context: string
    answer: string
  }>({
    name: 'response_quality',
    model,
    promptTemplate: PROMPT_TEMPLATE,
    choices: { pass: 1, fail: 0 }
  })

  return asExperimentEvaluator({
    name: 'response_quality',
    kind: 'LLM',
    evaluate: async ({ input, output }) => {
      const answer = normalizeEvalRunResult(output).answerText

      if (!answer) {
        return {
          label: 'no_answer',
          score: 0.0,
          explanation: 'No answer generated'
        }
      }

      return evaluator.evaluate({
        query: String((input as Record<string, unknown>).query ?? ''),
        context: String((input as Record<string, unknown>).context ?? ''),
        answer
      })
    }
  })
}
