import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'
import { createFaithfulnessEvaluator } from '@arizeai/phoenix-evals'
import type { LanguageModel } from 'ai'

import { inputField, normalizeEvalRunResult } from '../eval-output'

// Phoenix's default faithfulness rubric uses {{context}} and assumes that block
// is the source-of-truth document body to verbatim-ground every claim against.
// Polymorph passes retrieved search results (title, URL, retrieved text). The
// retrieved text varies in length: replays carry full page content (capped at
// MAX_SNIPPET_CHARS per result in formatEvalContext), while some entries are
// only short previews. This template pins a two-tier contract: ground specific
// claims against substantial retrieved text, fall back to topic-alignment when
// only short previews exist.
interface FaithfulnessRecord {
  input: string
  output: string
  retrievedSearchResults: string
  [key: string]: unknown
}

const FAITHFULNESS_PROMPT_TEMPLATE = [
  {
    role: 'system' as const,
    content: `You are evaluating whether an assistant's response is faithful to the content retrieved by its search step.

The <retrieved_search_results> block lists search results the assistant retrieved: title, URL, and retrieved text for each. The retrieved text varies in length — some entries carry substantial page content, others only short previews.

Apply a two-tier standard:
1. When the retrieved text substantively covers a claim's topic, the claim must be consistent with that text. Score "unfaithful" if the response asserts specific facts (numbers, dates, names, quotes) that CONTRADICT the retrieved text.
2. When the retrieved text is only a short preview that cannot verify a claim either way, judge topical alignment only. Absence of verbatim support in a short preview is NOT evidence of fabrication.

Score "unfaithful" when the response contradicts the retrieved content, or fabricates entities/sources not represented in the retrieval. Score "faithful" otherwise. Do NOT penalize reasonable synthesis or general knowledge that neither contradicts nor misattributes the retrieved content.`
  },
  {
    role: 'user' as const,
    content: `<data>
<query>
{{input}}
</query>

<retrieved_search_results>
{{retrievedSearchResults}}
</retrieved_search_results>

<response>
{{output}}
</response>
</data>

Is the response above faithful or unfaithful given the query and the retrieved results?`
  }
]

export function createFaithfulnessExperimentEvaluator(model: LanguageModel) {
  const evaluator = createFaithfulnessEvaluator<FaithfulnessRecord>({
    model,
    promptTemplate: FAITHFULNESS_PROMPT_TEMPLATE,
    // The system message is a trusted, static rubric. Phoenix forwards this
    // AI SDK option even though its public evaluator type does not expose it.
    ...{ allowSystemInMessages: true }
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
        retrievedSearchResults: context,
        output: answer
      })
    }
  })
}
