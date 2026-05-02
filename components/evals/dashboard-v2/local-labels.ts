import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'

export const LOCAL_LABEL_OVERRIDES: Record<string, string> = {}

export function localLabel(key: string): string {
  return LOCAL_LABEL_OVERRIDES[key] ?? getEvaluatorLabel(key)
}
