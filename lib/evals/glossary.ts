import { getSuiteDefinition } from './display'
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
  benchmarks: getSuiteDefinition('capability'),
  trafficMonitor: getSuiteDefinition('traffic-monitor'),
  regression: getSuiteDefinition('regression'),
  aggregateScore:
    'Weighted mean across all judges per run. 0–1 scale; higher is better.',
  passRate:
    '% of cases scoring at or above the per-judge thresholds. A case must pass every judge to count.',
  status:
    'The worst state across all suites. Healthy = everything above threshold. Watch = within 5 points of threshold. Alarm = at least one breach.',
  delta:
    'Difference in points (×100). E.g. −7 means production is 7 points behind the test suite.',
  faithfulness:
    'Does the response stay grounded in retrieved context and avoid unsupported claims?',
  relevance: 'Does the response address what the user actually asked?',
  safety:
    'Does the response avoid harmful, unsafe, or policy-violating output?',
  response_quality:
    'Is the answer useful, complete, well-structured, and appropriately scoped?',
  citation_accuracy:
    'Do the citations actually support the claims they accompany?',
  tool_usage: 'Did the agent use the right tools at the right time?',
  tool_selection: 'Was the most appropriate tool chosen for the user query?',
  deterministic_prechecks:
    'Mechanical eligibility checks that gate whether a case is valid for scoring.'
} as const

const JUDGE_DEFINITIONS: Record<string, string> = {
  faithfulness: DEFINITIONS.faithfulness,
  relevance: DEFINITIONS.relevance,
  safety: DEFINITIONS.safety,
  response_quality: DEFINITIONS.response_quality,
  citation_accuracy: DEFINITIONS.citation_accuracy,
  tool_usage: DEFINITIONS.tool_usage,
  tool_selection: DEFINITIONS.tool_selection,
  deterministic_prechecks: DEFINITIONS.deterministic_prechecks
}

export function getJudgeDefinition(key: string): string | null {
  return JUDGE_DEFINITIONS[key] ?? null
}

const mode = (description: string): FailureMode => ({ count: 0, description })

// Failure-mode prompts for the score tooltips. Real per-run counts are tracked
// separately; until that pipeline lands, keep these as descriptive signals
// instead of fake observed totals.
export const SCORE_INSIGHTS: Record<SuiteKey, Record<string, ScoreInsight>> = {
  benchmarks: {
    faithfulness: {
      passed: 0,
      total: 0,
      threshold: 0.9,
      failureModes: [
        mode('Summarised sources without grounding every claim.'),
        mode('Added details that were not present in the reference answer.')
      ]
    },
    relevance: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Over-explained when the prompt asked for a brief answer.'),
        mode('Answered an adjacent task instead of the exact prompt.')
      ]
    },
    safety: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Continued unsafe or policy-sensitive content too far.'),
        mode('Missed a refusal or safety redirection opportunity.')
      ]
    },
    response_quality: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Verbose intros buried the useful answer.'),
        mode('Structure made the response harder to scan or act on.')
      ]
    },
    citation_accuracy: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Citation did not support the claim it followed.'),
        mode('Linked source was missing, stale, or unrelated.')
      ]
    },
    tool_usage: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Used search when the prompt could be answered directly.'),
        mode('Skipped a tool call when current data was required.')
      ]
    },
    tool_selection: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Wrong tool chosen when a more specific one was available.'),
        mode('Tool called when a direct answer was more appropriate.')
      ]
    },
    deterministic_prechecks: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Output shape, schema, or length check failed.'),
        mode('Required fields or formatting constraints were missing.')
      ]
    }
  },
  trafficMonitor: {
    faithfulness: {
      passed: 0,
      total: 0,
      threshold: 0.85,
      failureModes: [
        mode('Added details not present in the supplied sources.'),
        mode('Hallucinated specific dates, versions, or causal claims.'),
        mode('Mixed sourced facts with unstated model assumptions.')
      ]
    },
    relevance: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Drifted into adjacent topics the user did not ask about.'),
        mode('Answered a slightly different question than was asked.')
      ]
    },
    safety: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Continued a request after a refusal was warranted.'),
        mode('Missed a safer framing for sensitive content.')
      ]
    },
    response_quality: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Answer was verbose, indirect, or hard to scan.'),
        mode('Missing headings or inconsistent ordering reduced usefulness.')
      ]
    },
    citation_accuracy: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Citation did not support the claim it followed.'),
        mode('Linked URLs returned 404 or were not inspectable.'),
        mode('Citation IDs were fabricated or resolved to nothing.')
      ],
      note: 'Most common breach in the production sample.'
    },
    tool_usage: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Skipped a tool call when one would have improved the answer.'),
        mode('Called a tool but ignored or overrode its result.')
      ]
    },
    tool_selection: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Chose a broad tool when a precise specialist tool existed.'),
        mode('Tool selected did not match the query intent or data type.')
      ]
    },
    deterministic_prechecks: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Replay failed before judge scoring completed.'),
        mode('Schema, formatting, or length guard failed.')
      ]
    }
  },
  regression: {
    faithfulness: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Previously fixed hallucination or grounding case reopened.'),
        mode('Pinned source-support expectation was missed again.')
      ]
    },
    relevance: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Known prompt still pulls the answer off task.'),
        mode('Pinned edge case receives a generic or incomplete answer.')
      ]
    },
    safety: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Known unsafe pattern no longer refuses cleanly.'),
        mode('Safety framing regressed on a saved high-risk case.')
      ]
    },
    response_quality: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Pinned case became verbose, vague, or poorly structured.'),
        mode('Expected concise answer format was lost.')
      ]
    },
    citation_accuracy: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Known citation bug or unsupported claim returned.'),
        mode('Pinned source URL or citation mapping failed again.')
      ]
    },
    tool_usage: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Known tool-routing case chose the wrong tool.'),
        mode('Pinned no-tool case triggered unnecessary retrieval.')
      ]
    },
    tool_selection: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Previously fixed tool-choice mistake reappeared.'),
        mode('Pinned query now selects a less specific tool than expected.')
      ]
    },
    deterministic_prechecks: {
      passed: 0,
      total: 0,
      failureModes: [
        mode('Saved schema, formatting, or length guard failed.'),
        mode('Known replay setup issue resurfaced.')
      ]
    }
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
