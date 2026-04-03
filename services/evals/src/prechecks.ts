import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'

import { normalizeEvalRunResult } from './eval-output'
import type { EvalRunResult } from './types'

export function createDeterministicPrecheckEvaluator({
  requiresTextAnswer,
  requiresCitations,
  allowsInteractiveOnly
}: {
  requiresTextAnswer: boolean
  requiresCitations: boolean
  allowsInteractiveOnly: boolean
}) {
  return asExperimentEvaluator({
    name: 'deterministic_prechecks',
    kind: 'CODE',
    evaluate: async ({ output }) => {
      const result = normalizeEvalRunResult(output)
      return evaluatePrechecks(result, {
        requiresTextAnswer,
        requiresCitations,
        allowsInteractiveOnly
      })
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
