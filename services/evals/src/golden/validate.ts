import { createFaithfulnessExperimentEvaluator } from '../evaluators/faithfulness'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from '../evaluators/response-quality'
import { createToolUsageExperimentEvaluator } from '../evaluators/tool-usage'
import { createJudgeConfig } from '../judge-config'
import { createJudgeModel } from '../judge-model'
import { evaluatePrechecks } from '../prechecks'

import { buildEvalOutput, getGoldenExamples, type GoldenExample } from './index'

interface ValidationResult {
  evaluator: string
  total: number
  correct: number
  accuracy: number
  truePositives: number
  falseNegatives: number
  trueNegatives: number
  falsePositives: number
  tpr: number
  tnr: number
}

type EvaluatorResult = {
  label: string
  score: number | null
  explanation?: string
}

function classifyOutcome(
  expected: { label: string; score: number },
  actual: { label: string; score: number | null }
): 'tp' | 'tn' | 'fp' | 'fn' {
  const expectedPositive = expected.score > 0
  const actualPositive = actual.score !== null && actual.score > 0
  if (expectedPositive && actualPositive) return 'tp'
  if (!expectedPositive && !actualPositive) return 'tn'
  if (!expectedPositive && actualPositive) return 'fp'
  return 'fn'
}

function tally(
  evaluator: string,
  total: number,
  counts: { correct: number; tp: number; tn: number; fp: number; fn: number }
): ValidationResult {
  return {
    evaluator,
    total,
    correct: counts.correct,
    accuracy: total > 0 ? counts.correct / total : 0,
    truePositives: counts.tp,
    falseNegatives: counts.fn,
    trueNegatives: counts.tn,
    falsePositives: counts.fp,
    tpr: counts.tp + counts.fn > 0 ? counts.tp / (counts.tp + counts.fn) : 0,
    tnr: counts.tn + counts.fp > 0 ? counts.tn / (counts.tn + counts.fp) : 0
  }
}

async function validatePrechecks(
  examples: GoldenExample[]
): Promise<ValidationResult> {
  const counts = { correct: 0, tp: 0, tn: 0, fp: 0, fn: 0 }

  for (const example of examples) {
    const result = evaluatePrechecks(buildEvalOutput(example), {
      requiresTextAnswer: example.requiresTextAnswer,
      requiresCitations: example.requiresCitations,
      allowsInteractiveOnly: example.allowsInteractiveOnly
    })

    const isCorrect =
      result.label === example.expected.prechecks.label &&
      result.score === example.expected.prechecks.score
    if (isCorrect) counts.correct++

    const outcome = classifyOutcome(example.expected.prechecks, result)
    counts[outcome]++

    const status = isCorrect ? 'PASS' : 'FAIL'
    console.log(
      `  [${status}] ${example.id}: expected=${example.expected.prechecks.label}/${example.expected.prechecks.score} actual=${result.label}/${result.score}`
    )
  }

  return tally('prechecks', examples.length, counts)
}

async function validateLLMEvaluator(
  evaluatorName: string,
  examples: GoldenExample[],
  runEvaluator: (example: GoldenExample) => Promise<EvaluatorResult>
): Promise<ValidationResult> {
  const counts = { correct: 0, tp: 0, tn: 0, fp: 0, fn: 0 }
  let total = 0

  for (const example of examples) {
    const expectedKey = evaluatorName as keyof GoldenExample['expected']
    const expected = example.expected[expectedKey] as {
      label: string
      score: number
    } | null

    if (expected === null) {
      console.log(`  [SKIP] ${example.id}: expected skip`)
      continue
    }

    total++

    try {
      const result = await runEvaluator(example)

      const isCorrect =
        result.label === expected.label && result.score === expected.score
      if (isCorrect) counts.correct++

      counts[classifyOutcome(expected, result)]++

      const status = isCorrect ? 'PASS' : 'FAIL'
      console.log(
        `  [${status}] ${example.id}: expected=${expected.label}/${expected.score} actual=${result.label}/${result.score}`
      )
    } catch (error) {
      counts.fn++
      console.log(
        `  [ERROR] ${example.id}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  return tally(evaluatorName, total, counts)
}

export async function validateEvaluators(): Promise<ValidationResult[]> {
  const examples = getGoldenExamples()
  const results: ValidationResult[] = []

  // 1. Validate prechecks (deterministic, always runs)
  console.log('\n=== Prechecks (deterministic) ===')
  results.push(await validatePrechecks(examples))

  // 2. Validate tool_usage (deterministic, always runs)
  console.log('\n=== Tool Usage (deterministic) ===')
  const toolUsageEval = createToolUsageExperimentEvaluator()
  results.push(
    await validateLLMEvaluator('tool_usage', examples, async example => {
      const evalResult = await toolUsageEval.evaluate({
        input: { query: example.query, context: example.context },
        output: buildEvalOutput(example),
        metadata: {
          requiresCitations: example.requiresCitations
        }
      })
      return evalResult as EvaluatorResult
    })
  )

  // 3-5. Validate LLM evaluators (require API credentials)
  const judgeConfig = createJudgeConfig()
  if (!judgeConfig.judgeApiKey && !process.env.OPENROUTER_API_KEY) {
    console.log('\n[WARN] Missing judge API key — skipping LLM evaluators.')
    return results
  }

  let model: any
  try {
    model = createJudgeModel()
  } catch (error) {
    console.log(
      '\n[WARN] Could not create judge model — skipping LLM evaluators.'
    )
    console.log(`  ${error instanceof Error ? error.message : String(error)}`)
    return results
  }

  const faithfulnessEval = createFaithfulnessExperimentEvaluator(model)
  const relevanceEval = createRelevanceExperimentEvaluator(model)
  const qualityEval = createResponseQualityExperimentEvaluator(model)

  function runEval(evaluator: {
    evaluate: (args: any) => any
  }): (example: GoldenExample) => Promise<EvaluatorResult> {
    return async example => {
      const evalResult = await evaluator.evaluate({
        input: { query: example.query, context: example.context },
        output: buildEvalOutput(example)
      })
      return evalResult as EvaluatorResult
    }
  }

  const [faithfulness, relevance, responseQuality] = await Promise.all([
    (console.log('\n=== Faithfulness (LLM) ==='),
    validateLLMEvaluator('faithfulness', examples, runEval(faithfulnessEval))),
    (console.log('\n=== Relevance (LLM) ==='),
    validateLLMEvaluator('relevance', examples, runEval(relevanceEval))),
    (console.log('\n=== Response Quality (LLM) ==='),
    validateLLMEvaluator('response_quality', examples, runEval(qualityEval)))
  ])

  results.push(faithfulness, relevance, responseQuality)

  // Safety evaluator is intentionally excluded — it's in a non-blocking calibration
  // phase (excludeFromThreshold) and golden examples will be added once scoring
  // baselines stabilize.
  return results
}

function printSummary(results: ValidationResult[]) {
  console.log('\n' + '='.repeat(72))
  console.log('VALIDATION SUMMARY')
  console.log('='.repeat(72))

  const header = [
    'Evaluator'.padEnd(20),
    'Acc'.padStart(6),
    'TPR'.padStart(6),
    'TNR'.padStart(6),
    'TP'.padStart(4),
    'FN'.padStart(4),
    'TN'.padStart(4),
    'FP'.padStart(4),
    'N'.padStart(4)
  ].join(' ')

  console.log(header)
  console.log('-'.repeat(72))

  for (const r of results) {
    const row = [
      r.evaluator.padEnd(20),
      `${(r.accuracy * 100).toFixed(1)}%`.padStart(6),
      `${(r.tpr * 100).toFixed(1)}%`.padStart(6),
      `${(r.tnr * 100).toFixed(1)}%`.padStart(6),
      String(r.truePositives).padStart(4),
      String(r.falseNegatives).padStart(4),
      String(r.trueNegatives).padStart(4),
      String(r.falsePositives).padStart(4),
      String(r.total).padStart(4)
    ].join(' ')
    console.log(row)
  }

  console.log('='.repeat(72))
}

// ── Main ─────────────────────────────────────────────────────────

const results = await validateEvaluators()
printSummary(results)

// Exit with code 1 if any metric is below threshold
const ACCURACY_THRESHOLD = 0.8
const TPR_THRESHOLD = 0.8
const TNR_THRESHOLD = 0.8

let failed = false
for (const r of results) {
  if (r.accuracy < ACCURACY_THRESHOLD) {
    console.log(
      `\nFAIL: ${r.evaluator} accuracy ${(r.accuracy * 100).toFixed(1)}% < ${ACCURACY_THRESHOLD * 100}%`
    )
    failed = true
  }
  if (r.tpr < TPR_THRESHOLD) {
    console.log(
      `\nFAIL: ${r.evaluator} TPR ${(r.tpr * 100).toFixed(1)}% < ${TPR_THRESHOLD * 100}%`
    )
    failed = true
  }
  if (r.tnr < TNR_THRESHOLD) {
    console.log(
      `\nFAIL: ${r.evaluator} TNR ${(r.tnr * 100).toFixed(1)}% < ${TNR_THRESHOLD * 100}%`
    )
    failed = true
  }
}

if (failed) {
  process.exit(1)
} else {
  console.log('\nAll evaluators passed validation thresholds.')
}
