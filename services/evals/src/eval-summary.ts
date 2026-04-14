import type {
  ExperimentEvaluationRun,
  RanExperiment
} from '@arizeai/phoenix-client/types/experiments'
import { createId } from '@paralleldrive/cuid2'
import { sql } from 'drizzle-orm'

import type { PersistedEvalSuite } from './types'

export function normalizeEvaluationRuns(experiment: RanExperiment) {
  return Array.isArray(experiment.evaluationRuns)
    ? experiment.evaluationRuns
    : []
}

export function computeEvaluatorAverages(
  runs: ExperimentEvaluationRun[]
): Record<string, number> {
  const groupedScores = new Map<string, number[]>()

  for (const run of runs) {
    if (run.error || !run.result || run.result.score == null) {
      continue
    }

    const existing = groupedScores.get(run.name) ?? []
    existing.push(run.result.score)
    groupedScores.set(run.name, existing)
  }

  return Object.fromEntries(
    [...groupedScores.entries()].map(([name, scores]) => [
      name,
      scores.reduce((total, score) => total + score, 0) / scores.length
    ])
  )
}

function clampPassRateBps(passRate: number) {
  return Math.max(0, Math.min(10000, Math.round(passRate * 10000)))
}

export async function persistEvalSummary(
  db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
  params: {
    suite: PersistedEvalSuite
    experimentName: string
    datasetName: string
    passRate: number
    experiment: RanExperiment
    totalCases: number
    phoenixUrl: string | null
  }
) {
  const evaluatorScores = computeEvaluatorAverages(
    normalizeEvaluationRuns(params.experiment)
  )

  await db.execute(sql`
    INSERT INTO eval_summaries (
      id,
      suite,
      experiment_name,
      dataset_name,
      pass_rate_bps,
      evaluator_scores,
      total_cases,
      phoenix_url
    )
    VALUES (
      ${createId()},
      ${params.suite},
      ${params.experimentName},
      ${params.datasetName},
      ${clampPassRateBps(params.passRate)},
      CAST(${JSON.stringify(evaluatorScores)} AS jsonb),
      ${params.totalCases},
      ${params.phoenixUrl}
    )
    ON CONFLICT (experiment_name) DO UPDATE SET
      pass_rate_bps = EXCLUDED.pass_rate_bps,
      evaluator_scores = EXCLUDED.evaluator_scores,
      total_cases = EXCLUDED.total_cases,
      phoenix_url = EXCLUDED.phoenix_url
  `)
}
