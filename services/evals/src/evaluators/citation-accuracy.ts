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

Classify (choose exactly one label):
- "accurate": All citations match sources in search results and support their claims
- "mostly_accurate": Most citations are accurate, minor issues
- "mixed": Some citations are accurate, some are fabricated or misattributed
- "mostly_inaccurate": Most citations don't match search results or don't support claims
- "fabricated": Citations appear to be fabricated (URLs not in search results)`

export const CITATION_LABEL_SCORES: Record<string, number> = {
  accurate: 1,
  mostly_accurate: 0.75,
  // Below the 0.5 pass cutoff on purpose: "some citations fabricated or
  // misattributed" is a failing outcome for a research product.
  mixed: 0.4,
  mostly_inaccurate: 0.25,
  fabricated: 0
}

const CitationAccuracySchema = z.object({
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
          score: null,
          explanation:
            'Citations present but no search results available to verify against — cannot assess accuracy'
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
        score: CITATION_LABEL_SCORES[object.label],
        explanation: object.explanation
      }
    }
  })
}
