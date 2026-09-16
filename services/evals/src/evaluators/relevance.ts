import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'
import { createDocumentRelevanceEvaluator } from '@arizeai/phoenix-evals'
import type { LanguageModel } from 'ai'

import { inputField } from '../eval-output'

// Phoenix's default document-relevance rubric uses {{documentText}} and frames
// the input as a single document body to be checked for the literal answer.
// Polymorph passes a list of retrieved search-result titles + URLs + ~140-char
// snippets, which strict-instruction-following judges read as a "document" and
// then mark "unrelated" because the snippets don't contain the literal answer.
// This template renames the placeholder and adds a system message that defines
// relevance as topical alignment of the retrieval, not literal answer-presence.
interface RelevanceRecord {
  input: string
  retrievedSearchTopics: string
  [key: string]: unknown
}

const RELEVANCE_PROMPT_TEMPLATE = [
  {
    role: 'system' as const,
    content: `You are evaluating whether an assistant's retrieval step surfaced topics relevant to the user's query.

The <retrieved_search_topics> block is a structured list of search-result titles, URLs, and short (~140 character) snippets returned by the assistant's search step. Each item is a topical pointer to a real source page, NOT the full document body. Snippets are by design too short to fully answer most questions.

Score "relevant" when the retrieved titles and snippets indicate the assistant searched for the right topic — i.e., a knowledgeable reader would expect the linked pages to contain answers to the query. Topical alignment is sufficient; the snippets do not need to contain the literal answer text.

Score "unrelated" only when the search topics are clearly off-target — wrong domain, wrong subject, or no semantic connection to the query. Do NOT mark "unrelated" merely because the snippets do not contain the answer text — that would be checking the snippet content against the question rather than checking topical alignment.`
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
</data>

Are the retrieved search topics above relevant to the query?`
  }
]

export function createRelevanceExperimentEvaluator(model: LanguageModel) {
  const evaluator = createDocumentRelevanceEvaluator<RelevanceRecord>({
    model,
    promptTemplate: RELEVANCE_PROMPT_TEMPLATE,
    // The system message is a trusted, static rubric. Phoenix forwards this
    // AI SDK option even though its public evaluator type does not expose it.
    ...{ allowSystemInMessages: true }
  })

  return asExperimentEvaluator({
    name: 'relevance',
    kind: 'LLM',
    evaluate: async ({
      input,
      metadata
    }: {
      input: Record<string, unknown>
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

      if (!context) {
        if (metadata?.requiresCitations === true) {
          return {
            label: 'no_results',
            score: 0.0,
            explanation:
              'Case required retrieval but no search results were returned'
          }
        }
        return {
          label: 'skipped',
          score: null,
          explanation:
            'No search performed — this case does not require retrieval, so relevance is not applicable'
        }
      }

      return evaluator.evaluate({
        input: inputField(input, 'query'),
        retrievedSearchTopics: context
      })
    }
  })
}
