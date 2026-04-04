import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'

import { normalizeEvalRunResult } from './eval-output'
import type { EvalRunResult } from './types'

export function createDeterministicPrecheckEvaluator() {
  return asExperimentEvaluator({
    name: 'deterministic_prechecks',
    kind: 'CODE',
    evaluate: async ({
      output,
      metadata
    }: {
      output: unknown
      metadata?: Record<string, unknown> | null
    }) => {
      const result = normalizeEvalRunResult(output)
      const requirements = {
        requiresTextAnswer: metadata?.requiresTextAnswer !== false,
        requiresCitations: metadata?.requiresCitations === true,
        allowsInteractiveOnly: metadata?.allowsInteractiveOnly !== false
      }
      return evaluatePrechecks(result, requirements)
    }
  })
}

export function evaluatePrechecks(
  result: EvalRunResult,
  requirements: {
    requiresTextAnswer: boolean
    requiresCitations: boolean
    allowsInteractiveOnly: boolean
  }
) {
  const answerText = result.answerText.trim()
  if (!requirements.allowsInteractiveOnly && result.usedInteractiveOnlyOutput) {
    return {
      label: 'interactive_only_output',
      score: 0,
      explanation: 'Interactive-only output is not allowed for this case'
    }
  }

  if (requirements.requiresTextAnswer && !answerText) {
    return {
      label: 'missing_answer',
      score: 0,
      explanation: 'Expected a non-empty text answer'
    }
  }

  if (requirements.requiresCitations && result.citations.length === 0) {
    return {
      label: 'missing_citations',
      score: 0,
      explanation: 'Expected at least one citation'
    }
  }

  return {
    label: 'pass',
    score: 1,
    explanation: 'All deterministic checks passed'
  }
}
