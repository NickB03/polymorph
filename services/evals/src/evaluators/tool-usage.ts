import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'

import { normalizeEvalRunResult } from '../eval-output'

/**
 * Deterministic tool-usage evaluator with a 4-level rubric:
 *
 * 1.0 — tools_used: Tools called, search results returned, citations present (if required)
 * 0.5 — tools_ineffective: Tools called but search returned no results
 * 0.5 — citations_missing: Tools called + results returned, but citations required and absent
 * 0.0 — tools_missing: Citations required but no tools were called
 * null — skipped: Case doesn't require citations and no tools were expected
 */
export function createToolUsageExperimentEvaluator() {
  return asExperimentEvaluator({
    name: 'tool_usage',
    kind: 'CODE',
    evaluate: async ({
      output,
      metadata
    }: {
      output: unknown
      metadata?: Record<string, unknown> | null
    }) => {
      const result = normalizeEvalRunResult(output)
      const toolsUsed = result.toolNames.length > 0
      const hasSearchResults = result.searchResults.some(
        sr => sr.results.length > 0
      )
      const hasCitations = result.citations.length > 0
      const requiresCitations = metadata?.requiresCitations === true

      // Case doesn't need citations and no tools were used — nothing to evaluate
      if (!requiresCitations && !toolsUsed) {
        return {
          label: 'skipped',
          score: null,
          explanation:
            'Tool usage not required for this case type; skipping evaluation'
        }
      }

      // Citations required but no tools called — hard fail
      if (requiresCitations && !toolsUsed) {
        return {
          label: 'tools_missing',
          score: 0.0,
          explanation:
            'Citations were required but no search tools were invoked'
        }
      }

      // Tools called but search returned no results
      if (toolsUsed && !hasSearchResults) {
        return {
          label: 'tools_ineffective',
          score: 0.5,
          explanation:
            'Search tools were called but returned no results — may indicate a bad query or service issue'
        }
      }

      // Tools called, results returned, but citations required and missing
      if (requiresCitations && hasSearchResults && !hasCitations) {
        return {
          label: 'citations_missing',
          score: 0.5,
          explanation:
            'Search results were available but no citations were produced in the answer'
        }
      }

      // Everything looks good
      return {
        label: 'tools_used',
        score: 1.0,
        explanation: toolsUsed
          ? `Tools used: ${result.toolNames.join(', ')}${hasCitations ? ` with ${result.citations.length} citation(s)` : ''}`
          : 'No tools needed and none used'
      }
    }
  })
}
