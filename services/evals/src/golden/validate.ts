import { createFaithfulnessExperimentEvaluator } from '../evaluators/faithfulness'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from '../evaluators/response-quality'
import { evaluatePrechecks } from '../prechecks'
import { createJudgeModel } from '../runners/shared'

import { getGoldenExamples, type GoldenExample } from './index'

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

async function validatePrechecks(
  examples: GoldenExample[]
): Promise<ValidationResult> {
  let correct = 0
  let tp = 0
  let tn = 0
  let fp = 0
  let fn = 0

  for (const example of examples) {
    const result = evaluatePrechecks(
      {
        answerText: example.answer,
        citations: example.citations,
        searchResults: [],
        toolNames: [],
        usedInteractiveOnlyOutput: example.usedInteractiveOnlyOutput,
        modelId: '',
        durationMs: 0
      },
      {
        requiresTextAnswer: example.requiresTextAnswer,
        requiresCitations: example.requiresCitations,
        allowsInteractiveOnly: example.allowsInteractiveOnly
      }
    )

    const labelMatch = result.label === example.expected.prechecks.label
    const scoreMatch = result.score === example.expected.prechecks.score
    const isCorrect = labelMatch && scoreMatch

    if (isCorrect) correct++

    const outcome = classifyOutcome(example.expected.prechecks, result)
    if (outcome === 'tp') tp++
    else if (outcome === 'tn') tn++
    else if (outcome === 'fp') fp++
    else fn++

    const status = isCorrect ? 'PASS' : 'FAIL'
    console.log(
      `  [${status}] ${example.id}: expected=${example.expected.prechecks.label}/${example.expected.prechecks.score} actual=${result.label}/${result.score}`
    )
  }

  const total = examples.length
  return {
    evaluator: 'prechecks',
    total,
    correct,
    accuracy: total > 0 ? correct / total : 0,
    truePositives: tp,
    falseNegatives: fn,
    trueNegatives: tn,
    falsePositives: fp,
    tpr: tp + fn > 0 ? tp / (tp + fn) : 0,
    tnr: tn + fp > 0 ? tn / (tn + fp) : 0
  }
}

async function validateLLMEvaluator(
  evaluatorName: string,
  examples: GoldenExample[],
  runEvaluator: (example: GoldenExample) => Promise<EvaluatorResult>
): Promise<ValidationResult> {
  let correct = 0
  let tp = 0
  let tn = 0
  let fp = 0
  let fn = 0
  let total = 0

  for (const example of examples) {
    const expectedKey = evaluatorName as keyof GoldenExample['expected']
    const expected = example.expected[expectedKey] as {
      label: string
      score: number
    } | null

    // Skip examples where we expect a skip/null
    if (expected === null) {
      console.log(`  [SKIP] ${example.id}: expected skip`)
      continue
    }

    total++

    try {
      const result = await runEvaluator(example)

      const labelMatch = result.label === expected.label
      const scoreMatch = result.score === expected.score
      const isCorrect = labelMatch && scoreMatch

      if (isCorrect) correct++

      const outcome = classifyOutcome(expected, result)
      if (outcome === 'tp') tp++
      else if (outcome === 'tn') tn++
      else if (outcome === 'fp') fp++
      else fn++

      const status = isCorrect ? 'PASS' : 'FAIL'
      console.log(
        `  [${status}] ${example.id}: expected=${expected.label}/${expected.score} actual=${result.label}/${result.score}`
      )
    } catch (error) {
      fn++
      console.log(
        `  [ERROR] ${example.id}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  return {
    evaluator: evaluatorName,
    total,
    correct,
    accuracy: total > 0 ? correct / total : 0,
    truePositives: tp,
    falseNegatives: fn,
    trueNegatives: tn,
    falsePositives: fp,
    tpr: tp + fn > 0 ? tp / (tp + fn) : 0,
    tnr: tn + fp > 0 ? tn / (tn + fp) : 0
  }
}

export async function validateEvaluators(): Promise<ValidationResult[]> {
  const examples = getGoldenExamples()
  const results: ValidationResult[] = []

  // 1. Validate prechecks (deterministic, always runs)
  console.log('\n=== Prechecks (deterministic) ===')
  results.push(await validatePrechecks(examples))

  // 2-4. Validate LLM evaluators (require API credentials)
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

  // 2. Validate faithfulness
  console.log('\n=== Faithfulness (LLM) ===')
  results.push(
    await validateLLMEvaluator('faithfulness', examples, async example => {
      const evalResult = await faithfulnessEval.evaluate({
        input: { query: example.query, context: example.context },
        output: {
          answerText: example.answer,
          citations: example.citations,
          searchResults: [],
          toolNames: [],
          usedInteractiveOnlyOutput: example.usedInteractiveOnlyOutput,
          modelId: '',
          durationMs: 0
        }
      })
      return evalResult as EvaluatorResult
    })
  )

  // 3. Validate relevance
  console.log('\n=== Relevance (LLM) ===')
  results.push(
    await validateLLMEvaluator('relevance', examples, async example => {
      const evalResult = await relevanceEval.evaluate({
        input: { query: example.query, context: example.context },
        output: {
          answerText: example.answer,
          citations: example.citations,
          searchResults: [],
          toolNames: [],
          usedInteractiveOnlyOutput: example.usedInteractiveOnlyOutput,
          modelId: '',
          durationMs: 0
        }
      })
      return evalResult as EvaluatorResult
    })
  )

  // 4. Validate response quality
  console.log('\n=== Response Quality (LLM) ===')
  results.push(
    await validateLLMEvaluator('response_quality', examples, async example => {
      const evalResult = await qualityEval.evaluate({
        input: { query: example.query, context: example.context },
        output: {
          answerText: example.answer,
          citations: example.citations,
          searchResults: [],
          toolNames: [],
          usedInteractiveOnlyOutput: example.usedInteractiveOnlyOutput,
          modelId: '',
          durationMs: 0
        }
      })
      return evalResult as EvaluatorResult
    })
  )

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
const TPR_THRESHOLD = 0.7
const TNR_THRESHOLD = 0.7

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
