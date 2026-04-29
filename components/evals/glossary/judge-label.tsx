'use client'

import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import { getJudgeDefinition } from '@/lib/evals/glossary'

import { DefinedTerm } from '@/components/evals/glossary/defined-term'

export function JudgeLabel({ judgeKey }: { judgeKey: string }) {
  const def = getJudgeDefinition(judgeKey)
  const label = getEvaluatorLabel(judgeKey)
  if (!def) return <>{label}</>
  return <DefinedTerm def={def}>{label}</DefinedTerm>
}
