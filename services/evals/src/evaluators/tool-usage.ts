import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'

import { normalizeEvalRunResult } from '../eval-output'

/**
 * Tools whose calls are expected to produce search results. Only these count
 * toward the `tools_ineffective` check — non-search tools (geo, display, etc.)
 * are legitimate work that returns no search results.
 */
export const SEARCH_TOOL_NAMES: readonly string[] = [
  'search',
  'fetch',
  'competitorResearch'
]

/**
 * Deterministic tool-usage evaluator with a 4-level rubric:
 *
 * 1.0 — tools_used: Tools called, search results returned, citations present (if required)
 * 0.5 — tools_ineffective: Search tools called but search returned no results
 * 0.5 — citations_missing: Tools called but citations required and absent
 *        (covers both search-with-results-but-no-citations and non-search-tools-only)
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
      const searchToolsUsed = result.toolNames.some(name =>
        SEARCH_TOOL_NAMES.includes(name)
      )
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

      // Search tools called but search returned no results
      if (searchToolsUsed && !hasSearchResults) {
        const searchToolsRan = result.toolNames.filter(name =>
          SEARCH_TOOL_NAMES.includes(name)
        )
        return {
          label: 'tools_ineffective',
          score: 0.5,
          explanation: `Search tools were called (${searchToolsRan.join(', ')}) but returned no results — may indicate a bad query or service issue`
        }
      }

      // Tools were called but citations required and missing. Reaching here
      // with hasSearchResults=false means only non-search tools ran (search
      // tools without results were caught by tools_ineffective above).
      if (requiresCitations && !hasCitations) {
        return {
          label: 'citations_missing',
          score: 0.5,
          explanation: hasSearchResults
            ? 'Search results were available but no citations were produced in the answer'
            : 'Citations were required but only non-search tools ran and no citations were produced'
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
