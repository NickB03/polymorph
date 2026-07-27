import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'
import { createClassificationEvaluator } from '@arizeai/phoenix-evals'
import type { LanguageModel } from 'ai'

import { inputField, normalizeEvalRunResult } from '../eval-output'

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
Criterion 4 is N/A when the search context is empty or is not relevant to the question — correctly disregarding irrelevant retrieval is not a deficiency; when the context is relevant it applies in full.

If this appears to be a research query (one requiring evidence, sources, or in-depth analysis), also consider:
5. Does it synthesize information from multiple sources when available?
6. Does it distinguish established facts from uncertain or debated claims?
If the query is not a research query, criteria 5 and 6 are N/A — ignore them.

Classifications (choose exactly one):
- "excellent": Meets all applicable criteria AND contributes something the retrieved sources do not already supply — synthesis across two or more distinct sources, or analysis, causal mechanism, or qualification of what is settled versus debated. A correct, complete, well-organized restatement of the retrieved content is "good", not "excellent". So is a correct answer produced with no usable retrieval to draw on, however sound it is.
- "good": Meets all applicable criteria — accurate, answers the question, readable, appropriate depth — but adds nothing beyond what its sources already supply. This is the correct label for a solid answer, not a demotion.
- "adequate": Meets minimum requirements but has notable weaknesses — shallow depth, poor organization, or partial answer
- "poor": Fails multiple criteria — misses key aspects of the question, disorganized, or largely ignores context
- "fail": Fundamentally broken — wrong topic, contradicts sources, garbled text, or empty of substance`

export function createResponseQualityExperimentEvaluator(model: LanguageModel) {
  const evaluator = createClassificationEvaluator<{
    query: string
    context: string
    answer: string
  }>({
    name: 'response_quality',
    model,
    promptTemplate: PROMPT_TEMPLATE,
    choices: { excellent: 1, good: 0.75, adequate: 0.5, poor: 0.25, fail: 0 }
  })

  return asExperimentEvaluator({
    name: 'response_quality',
    kind: 'LLM',
    evaluate: async ({
      input,
      output,
      metadata
    }: {
      input: Record<string, unknown>
      output: unknown
      metadata?: Record<string, unknown> | null
    }) => {
      if (metadata?.expectsRefusal === true) {
        return {
          label: 'skipped',
          score: null,
          explanation: 'Refusal case — quality assessed by safety evaluator'
        }
      }

      const answer = normalizeEvalRunResult(output).answerText

      if (!answer) {
        return {
          label: 'no_answer',
          score: 0.0,
          explanation: 'No answer generated'
        }
      }

      return evaluator.evaluate({
        query: inputField(input, 'query'),
        context: inputField(input, 'context'),
        answer
      })
    }
  })
}
