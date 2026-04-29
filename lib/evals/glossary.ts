import type { EvalSummarySnapshot } from './types'

export type SuiteKey = 'benchmarks' | 'trafficMonitor' | 'regression'

export type FailureMode = { count: number; description: string }

export type ScoreInsight = {
  passed: number
  total: number
  threshold?: number
  failureModes?: FailureMode[]
  note?: string
}

export const DEFINITIONS = {
  benchmarks:
    'A curated benchmark set. Run on demand against a fixed list of test prompts to measure how the model performs against a known reference.',
  trafficMonitor:
    'A rolling sample of real production chats, scored on a cron. Tells you what users are actually getting.',
  regression:
    'Pinned cases that previously broke. Run after material changes to catch drift. Silent unless one fails.',
  aggregateScore:
    'Weighted mean across all judges per run. 0–1 scale; higher is better.',
  passRate:
    '% of cases scoring at or above the per-judge thresholds. A case must pass every judge to count.',
  status:
    'The worst state across all suites. Healthy = everything above threshold. Watch = within 5 points of threshold. Alarm = at least one breach.',
  delta:
    'Difference in points (×100). E.g. −7 means the live column is 7 points behind the curated column.',
  faithfulness: 'Does the response stay grounded in the supplied sources?',
  relevance: 'Does the response address what the user actually asked?',
  safety:
    'Does the response avoid harmful, unsafe, or policy-violating output?',
  response_quality:
    'Is the response well-formed, useful, and appropriately scoped?',
  citation_accuracy:
    'Do the citations actually support the claims they accompany?',
  tool_usage: 'Did the agent reach for the right tools at the right time?',
  deterministic_prechecks:
    'Mechanical assertions that run before the LLM judges (formatting, schema, length).'
} as const

const JUDGE_DEFINITIONS: Record<string, string> = {
  faithfulness: DEFINITIONS.faithfulness,
  relevance: DEFINITIONS.relevance,
  safety: DEFINITIONS.safety,
  response_quality: DEFINITIONS.response_quality,
  citation_accuracy: DEFINITIONS.citation_accuracy,
  tool_usage: DEFINITIONS.tool_usage,
  deterministic_prechecks: DEFINITIONS.deterministic_prechecks
}

export function getJudgeDefinition(key: string): string | null {
  return JUDGE_DEFINITIONS[key] ?? null
}

// Placeholder fixtures. Real population from a failure-mode pipeline is
// tracked separately. Until then, these read as plausible defaults — the
// shape is the contract the UI relies on.
export const SCORE_INSIGHTS: Record<SuiteKey, Record<string, ScoreInsight>> = {
  benchmarks: {
    faithfulness: { passed: 0, total: 0 },
    relevance: { passed: 0, total: 0 },
    safety: { passed: 0, total: 0 },
    response_quality: { passed: 0, total: 0 },
    citation_accuracy: { passed: 0, total: 0 },
    tool_usage: { passed: 0, total: 0 },
    deterministic_prechecks: { passed: 0, total: 0 }
  },
  trafficMonitor: {
    faithfulness: { passed: 0, total: 0 },
    relevance: { passed: 0, total: 0 },
    safety: { passed: 0, total: 0 },
    response_quality: { passed: 0, total: 0 },
    citation_accuracy: {
      passed: 0,
      total: 0,
      failureModes: [
        {
          count: 0,
          description: 'Citation did not support the claim it followed.'
        },
        { count: 0, description: 'Linked URLs that returned 404.' },
        {
          count: 0,
          description: 'Fabricated citation IDs that resolve to nothing.'
        }
      ],
      note: 'Most common breach in the live sample.'
    },
    tool_usage: { passed: 0, total: 0 },
    deterministic_prechecks: { passed: 0, total: 0 }
  },
  regression: {
    faithfulness: { passed: 0, total: 0 },
    relevance: { passed: 0, total: 0 },
    safety: { passed: 0, total: 0 },
    response_quality: { passed: 0, total: 0 },
    citation_accuracy: { passed: 0, total: 0 },
    tool_usage: { passed: 0, total: 0 },
    deterministic_prechecks: { passed: 0, total: 0 }
  }
}

export function getScoreInsight(
  suite: SuiteKey,
  judgeKey: string
): ScoreInsight | null {
  return SCORE_INSIGHTS[suite]?.[judgeKey] ?? null
}

export function snapshotSuiteKey(snap: EvalSummarySnapshot): SuiteKey {
  switch (snap.suite) {
    case 'capability':
      return 'benchmarks'
    case 'traffic-monitor':
      return 'trafficMonitor'
    case 'regression':
      return 'regression'
  }
}
