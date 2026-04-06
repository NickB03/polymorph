import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'
import type { LanguageModel } from 'ai'
import { generateObject } from 'ai'
import { z } from 'zod'

import { formatEvalContext, normalizeEvalRunResult } from '../eval-output'

const CITATION_ACCURACY_PROMPT = `You are evaluating whether citations in an AI assistant's answer are accurate and relevant.

Given:
- The user's question
- Search results the assistant had access to
- The assistant's answer with citations

Evaluate each citation:
1. Does the cited source appear in the search results?
2. Does the cited source actually support the claim it's attached to?
3. Are there claims in the answer that should be cited but aren't?

Score:
- 1.0 (accurate): All citations match sources in search results and support their claims
- 0.75 (mostly_accurate): Most citations are accurate, minor issues
- 0.5 (mixed): Some citations are accurate, some are fabricated or misattributed
- 0.25 (mostly_inaccurate): Most citations don't match search results or don't support claims
- 0.0 (fabricated): Citations appear to be fabricated (URLs not in search results)`

const CitationAccuracySchema = z.object({
  score: z.number().min(0).max(1),
  label: z.enum([
    'accurate',
    'mostly_accurate',
    'mixed',
    'mostly_inaccurate',
    'fabricated'
  ]),
  explanation: z.string()
})

export function createCitationAccuracyExperimentEvaluator(
  model: LanguageModel
) {
  return asExperimentEvaluator({
    name: 'citation_accuracy',
    kind: 'LLM',
    evaluate: async ({ input, output }) => {
      const result = normalizeEvalRunResult(output)
      const { citations, searchResults, answerText } = result

      // No citations to evaluate
      if (citations.length === 0) {
        return {
          label: 'skipped',
          score: null,
          explanation: 'No citations to evaluate'
        }
      }

      // Citations present but no search results to cross-reference
      if (
        searchResults.length === 0 ||
        searchResults.every(sr => sr.results.length === 0)
      ) {
        return {
          label: 'no_search_context',
          score: 0.5,
          explanation:
            'Citations present but no search results available to verify against'
        }
      }

      // Build context for LLM judge
      const context = formatEvalContext({ searchResults, citations })
      const citationList = citations
        .map((c, i) => `[${i + 1}] ${c.title} (${c.url})`)
        .join('\n')

      const prompt =
        typeof input === 'object' && input !== null
          ? String((input as Record<string, unknown>).prompt ?? '')
          : ''

      const { object } = await generateObject({
        model,
        schema: CitationAccuracySchema,
        prompt: `${CITATION_ACCURACY_PROMPT}

## User Question
${prompt}

## Search Results Available
${context}

## Assistant's Answer
${answerText}

## Citations Used
${citationList}

Evaluate the citation accuracy:`
      })

      return {
        label: object.label,
        score: object.score,
        explanation: object.explanation
      }
    }
  })
}
