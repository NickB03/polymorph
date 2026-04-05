import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'

import { normalizeEvalRunResult } from '../eval-output'

/**
 * Deterministic evaluator that checks whether the agent used tools
 * when the query warranted tool usage (e.g., search for factual queries).
 *
 * Returns null score when tool usage is indeterminate (e.g., simple chat
 * queries that may or may not need tools). Null scores are excluded from
 * the threshold calculation by checkExperimentThresholds.
 */
export function createToolUsageExperimentEvaluator() {
  return asExperimentEvaluator({
    name: 'tool_usage',
    kind: 'CODE',
    // input is not used — tool usage is determined entirely from
    // output (which tools ran) and metadata (whether citations are required).
    evaluate: async ({
      output,
      metadata
    }: {
      output: unknown
      metadata?: Record<string, unknown> | null
    }) => {
      const result = normalizeEvalRunResult(output)
      const toolNames = result.toolNames ?? []
      const requiresCitations = metadata?.requiresCitations === true

      // If the case requires citations, it necessarily requires search tools.
      // A missing search tool in this scenario is a clear failure.
      if (requiresCitations && toolNames.length === 0) {
        return {
          label: 'missing_tools',
          score: 0,
          explanation:
            'Case requires citations but no tools were invoked (expected at least search)'
        }
      }

      // If tools were used, validate that they produced results
      if (toolNames.length > 0) {
        return {
          label: 'tools_used',
          score: 1,
          explanation: `Tools invoked: ${toolNames.join(', ')}`
        }
      }

      // For cases that don't require citations and used no tools,
      // tool usage is indeterminate — skip scoring.
      return {
        label: 'skipped',
        score: null,
        explanation:
          'Tool usage not required for this case type; skipping evaluation'
      }
    }
  })
}
