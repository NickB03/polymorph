import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'
import { createFaithfulnessEvaluator } from '@arizeai/phoenix-evals'
import type { LanguageModel } from 'ai'

import { inputField, normalizeEvalRunResult } from '../eval-output'

// Phoenix's default faithfulness rubric uses {{context}} and assumes that block
// is the source-of-truth document body to verbatim-ground every claim against.
// Polymorph passes a list of retrieved search-result titles + URLs + ~140-char
// snippets — a topical pointer, not the source corpus. Strict-instruction-
// following judges (e.g. nemotron-3) read the default rubric literally and
// label the response 'unfaithful' because the snippets don't contain the full
// claim text. This template renames the placeholder and adds a system message
// that pins the contract: snippets are previews, not grounding text.
interface FaithfulnessRecord {
  input: string
  output: string
  retrievedSearchTopics: string
  [key: string]: unknown
}

const FAITHFULNESS_PROMPT_TEMPLATE = [
  {
    role: 'system' as const,
    content: `You are evaluating whether an assistant's response is faithful to the topics surfaced by a retrieval step.

The <retrieved_search_topics> block is NOT a document body or source-of-truth corpus. It is a structured list of search-result titles, URLs, and short (~140 character) snippets that the assistant retrieved while researching the query. Treat it as an indicator of which topics the assistant had access to, NOT as the complete text the response must be verbatim-grounded against.

Score "faithful" when the response stays on-topic with the retrieved results and does not introduce specific factual claims (numbers, names, dates, quotes) that contradict or are unrelated to the retrieved topics.

Score "unfaithful" only when the response makes specific factual claims that clearly contradict the retrieved topics, or fabricates entities/sources not represented in the retrieval. Do NOT mark "unfaithful" merely because individual claims are not verbatim-quoted in the snippets — the snippets are by design too short to verify every claim, and absence of verbatim text is not evidence of fabrication.`
  },
  {
    role: 'user' as const,
    content: `<data>
<query>
{{input}}
</query>

<retrieved_search_topics>
{{retrievedSearchTopics}}
</retrieved_search_topics>

<response>
{{output}}
</response>
</data>

Is the response above faithful or unfaithful given the query and the retrieved topics? Respond with a single word: 'faithful' or 'unfaithful'.`
  }
]

export function createFaithfulnessExperimentEvaluator(model: LanguageModel) {
  const evaluator = createFaithfulnessEvaluator<FaithfulnessRecord>({
    model,
    promptTemplate: FAITHFULNESS_PROMPT_TEMPLATE
  })

  return asExperimentEvaluator({
    name: 'faithfulness',
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
          explanation: 'Refusal case — no search results expected'
        }
      }

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
        retrievedSearchTopics: context,
        output: answer
      })
    }
  })
}
