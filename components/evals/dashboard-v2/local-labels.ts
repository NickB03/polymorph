import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'

// Local label override: "Deterministic Prechecks" is too long for the
// 2-column row + AUTO badge layout in EvaluatorBreakdown. The canonical
// name (in `lib/evals/evaluator-labels.ts`) is preserved everywhere else.
export const LOCAL_LABEL_OVERRIDES: Record<string, string> = {
  deterministic_prechecks: 'Prechecks'
}

export function localLabel(key: string): string {
  return LOCAL_LABEL_OVERRIDES[key] ?? getEvaluatorLabel(key)
}
