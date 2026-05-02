import type {
  EvalCaseResultSnapshot,
  EvalFailureMode,
  EvalSummarySnapshot
} from './types'

export const FAILURE_MODE_LABELS: Record<EvalFailureMode, string> = {
  retrieval_miss: 'Retrieval miss',
  bad_citation: 'Bad citation',
  unsafe_response: 'Unsafe response',
  tool_not_called: 'Tool not called',
  tool_unnecessary: 'Tool called unnecessarily',
  answer_incomplete: 'Answer incomplete',
  contradicts_context: 'Contradicts context',
  other: 'Other'
}

export function caseResultsForEvaluator(
  snap: EvalSummarySnapshot,
  evaluatorName: string
) {
  return (snap.caseResults ?? []).filter(
    result => result.evaluatorName === evaluatorName
  )
}

export function failedCaseResultsForEvaluator(
  snap: EvalSummarySnapshot,
  evaluatorName: string
) {
  return caseResultsForEvaluator(snap, evaluatorName).filter(
    result => result.failed
  )
}

export function failureModeCounts(results: EvalCaseResultSnapshot[]) {
  const counts = new Map<EvalFailureMode, number>()
  for (const result of results) {
    if (!result.failed) continue
    counts.set(result.failureMode, (counts.get(result.failureMode) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([mode, count]) => ({
      mode,
      count,
      description: FAILURE_MODE_LABELS[mode]
    }))
    .sort((left, right) => right.count - left.count)
}

export function scoreAscending(
  left: EvalCaseResultSnapshot,
  right: EvalCaseResultSnapshot
) {
  if (left.error && !right.error) return -1
  if (!left.error && right.error) return 1
  return (left.score ?? 1) - (right.score ?? 1)
}

export function failureKey(result: EvalCaseResultSnapshot) {
  return `${result.caseId}:${result.evaluatorName}`
}
