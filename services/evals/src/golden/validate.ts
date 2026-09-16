import { getErrorMessage } from '../error'
import { formatEvalContext } from '../eval-output'
import { createCitationAccuracyExperimentEvaluator } from '../evaluators/citation-accuracy'
import { createFaithfulnessExperimentEvaluator } from '../evaluators/faithfulness'
import { createRefusalExperimentEvaluator } from '../evaluators/refusal'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createResponseQualityExperimentEvaluator } from '../evaluators/response-quality'
import { createSafetyExperimentEvaluator } from '../evaluators/safety'
import { createToolUsageExperimentEvaluator } from '../evaluators/tool-usage'
import { createJudgeConfig } from '../judge-config'
import { createJudgeModel } from '../judge-model'
import { evaluatePrechecks } from '../prechecks'

import { buildEvalOutput, getGoldenExamples, type GoldenExample } from './index'

interface ValidationRun {
  results: ValidationResult[]
  /**
   * How many evaluators a complete run measures. Derived from the golden
   * `expected` shape rather than hardcoded: validateEvaluators produces exactly
   * one ValidationResult per key there, so adding an evaluator (as `refusal`
   * was) updates this automatically instead of leaving a stale literal behind.
   */
  expectedEvaluatorCount: number
  /** Why the LLM evaluators did not run, or null when they did. */
  skippedReason: string | null
}

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
  /**
   * Cases whose expectation is `null` — "this evaluator should skip this case".
   * Kept OUT of `total` on purpose: folding them in would change every
   * evaluator's denominator and make the accuracy numbers incomparable to
   * previously recorded runs. They are a separate, equally real prediction.
   */
  skipVerified: number
  /** Null-expectation cases where the evaluator did NOT skip. Always a defect. */
  skipViolations: number
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
  counts: { correct: number; tp: number; tn: number; fp: number; fn: number },
  skips: { verified: number; violations: number } = {
    verified: 0,
    violations: 0
  }
): ValidationResult {
  return {
    evaluator,
    total,
    skipVerified: skips.verified,
    skipViolations: skips.violations,
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

// Method syntax, not a property arrow: TS checks method parameters
// bivariantly, so the concrete experiment evaluators still satisfy this while
// the test stub gets a compile-time contract check instead of `any`.
interface JudgeInvocable {
  evaluate(args: {
    input: Record<string, unknown>
    output: unknown
    metadata?: Record<string, unknown> | null
  }): unknown
}

export function runEval(
  evaluator: JudgeInvocable
): (example: GoldenExample) => Promise<EvaluatorResult> {
  return async example => {
    const output = buildEvalOutput(example)
    // Parity with production: buildDatasetExamples sets
    // context = formatEvalContext(output) (runners/shared.ts). Passing
    // example.context here would certify the judges against raw prose they
    // never see at runtime.
    const context = formatEvalContext(output)
    const evalResult = await evaluator.evaluate({
      input: {
        prompt: example.query,
        query: example.query,
        context
      },
      output,
      metadata: {
        requiresCitations: example.requiresCitations,
        expectsRefusal: example.expectsRefusal
      }
    })
    return evalResult as EvaluatorResult
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

// Exported so validate.test.ts can assert the null-expectation skip contract
// with a stub, without a paid run. Not part of the CLI surface.
export async function validateLLMEvaluator(
  evaluatorName: string,
  examples: GoldenExample[],
  runEvaluator: (example: GoldenExample) => Promise<EvaluatorResult>
): Promise<ValidationResult> {
  const counts = { correct: 0, tp: 0, tn: 0, fp: 0, fn: 0 }
  const skips = { verified: 0, violations: 0 }
  let total = 0

  for (const example of examples) {
    const expectedKey = evaluatorName as keyof GoldenExample['expected']
    const expected = example.expected[expectedKey] as {
      label: string
      score: number
    } | null

    // `null` means "this evaluator should skip this case" — a prediction, so
    // verify it instead of looking away. Every evaluator's skip guard returns
    // label 'skipped' with a null score BEFORE any judge call, so a correct
    // skip is free; a broken guard falls through to a real, paid call, which is
    // precisely the defect worth paying once to catch.
    if (expected === null) {
      try {
        const result = await runEvaluator(example)
        if (result.label === 'skipped' && result.score === null) {
          skips.verified++
          console.log(`  [SKIP-OK] ${example.id}: skipped as expected`)
        } else {
          skips.violations++
          console.log(
            `  [SKIP-FAIL] ${example.id}: expected skip, got ${result.label}/${result.score}`
          )
        }
      } catch (error) {
        skips.violations++
        console.log(`  [SKIP-ERROR] ${example.id}: ${getErrorMessage(error)}`)
      }
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
      console.log(`  [ERROR] ${example.id}: ${getErrorMessage(error)}`)
    }
  }

  return tally(evaluatorName, total, counts, skips)
}

function countExpectedEvaluators(examples: GoldenExample[]): number {
  const names = new Set<string>()
  for (const example of examples) {
    for (const name of Object.keys(example.expected)) names.add(name)
  }
  return names.size
}

export async function validateEvaluators(): Promise<ValidationRun> {
  const examples = getGoldenExamples()
  const expectedEvaluatorCount = countExpectedEvaluators(examples)
  const results: ValidationResult[] = []

  // 1. Validate prechecks (deterministic, always runs)
  console.log('\n=== Prechecks (deterministic) ===')
  results.push(await validatePrechecks(examples))

  // 2. Validate tool_usage (deterministic, always runs)
  console.log('\n=== Tool Usage (deterministic) ===')
  const toolUsageEval = createToolUsageExperimentEvaluator()
  results.push(
    await validateLLMEvaluator('tool_usage', examples, async example => {
      const output = buildEvalOutput(example)
      const evalResult = await toolUsageEval.evaluate({
        input: {
          query: example.query,
          context: formatEvalContext(output)
        },
        output,
        metadata: {
          requiresCitations: example.requiresCitations,
          expectsRefusal: example.expectsRefusal
        }
      })
      return evalResult as EvaluatorResult
    })
  )

  // 3-7. Validate LLM evaluators (require API credentials)
  const judgeConfig = createJudgeConfig()
  if (!judgeConfig.judgeApiKey && !process.env.OPENROUTER_API_KEY) {
    console.log('\n[WARN] Missing judge API key — skipping LLM evaluators.')
    return {
      results,
      expectedEvaluatorCount,
      skippedReason: 'no judge API key'
    }
  }

  let model: any
  try {
    model = createJudgeModel()
  } catch (error) {
    console.log(
      '\n[WARN] Could not create judge model — skipping LLM evaluators.'
    )
    console.log(`  ${getErrorMessage(error)}`)
    return {
      results,
      expectedEvaluatorCount,
      skippedReason: 'judge model unavailable'
    }
  }

  const faithfulnessEval = createFaithfulnessExperimentEvaluator(model)
  const relevanceEval = createRelevanceExperimentEvaluator(model)
  const qualityEval = createResponseQualityExperimentEvaluator(model)
  const safetyEval = createSafetyExperimentEvaluator(model)
  const citationAccuracyEval = createCitationAccuracyExperimentEvaluator(model)
  const refusalEval = createRefusalExperimentEvaluator(model)

  const [
    faithfulness,
    relevance,
    responseQuality,
    safety,
    citationAccuracy,
    refusal
  ] = await Promise.all([
    (console.log('\n=== Faithfulness (LLM) ==='),
    validateLLMEvaluator('faithfulness', examples, runEval(faithfulnessEval))),
    (console.log('\n=== Relevance (LLM) ==='),
    validateLLMEvaluator('relevance', examples, runEval(relevanceEval))),
    (console.log('\n=== Response Quality (LLM) ==='),
    validateLLMEvaluator('response_quality', examples, runEval(qualityEval))),
    (console.log('\n=== Safety (LLM) ==='),
    validateLLMEvaluator('safety', examples, runEval(safetyEval))),
    (console.log('\n=== Citation Accuracy (LLM) ==='),
    validateLLMEvaluator(
      'citation_accuracy',
      examples,
      runEval(citationAccuracyEval)
    )),
    (console.log('\n=== Refusal (LLM) ==='),
    validateLLMEvaluator('refusal', examples, runEval(refusalEval)))
  ])

  results.push(
    faithfulness,
    relevance,
    responseQuality,
    safety,
    citationAccuracy,
    refusal
  )

  return { results, expectedEvaluatorCount, skippedReason: null }
}

function printSummary(results: ValidationResult[]) {
  console.log('\n' + '='.repeat(85))
  console.log('VALIDATION SUMMARY')
  console.log('='.repeat(85))

  const header = [
    'Evaluator'.padEnd(20),
    'Acc'.padStart(6),
    'TPR'.padStart(6),
    'TNR'.padStart(6),
    'TP'.padStart(4),
    'FN'.padStart(4),
    'TN'.padStart(4),
    'FP'.padStart(4),
    'N'.padStart(4),
    'SkipOK'.padStart(7),
    'SkipX'.padStart(6)
  ].join(' ')

  console.log(header)
  console.log('-'.repeat(85))

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
      String(r.total).padStart(4),
      String(r.skipVerified).padStart(7),
      String(r.skipViolations).padStart(6)
    ].join(' ')
    console.log(row)
  }

  console.log('='.repeat(85))
  console.log(
    'N counts scored cases only. SkipOK/SkipX are null-expectation cases, ' +
      'verified separately.'
  )
}

// ── Main ─────────────────────────────────────────────────────────

// Guarded so validate.test.ts can import `runEval` to assert the judge-input
// contract without this module's paid judge suite (and its process.exit)
// firing as an import side effect. `bun run src/golden/validate.ts` — the
// `validate` script — still sets import.meta.main, so the CLI is unchanged.
if (import.meta.main) {
  const { results, expectedEvaluatorCount, skippedReason } =
    await validateEvaluators()
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
    // No threshold here: a skip guard is contractual, not statistical. One
    // violation means an evaluator scored a case it was supposed to abstain
    // from — and billed a judge call to do it.
    if (r.skipViolations > 0) {
      console.log(
        `\nFAIL: ${r.evaluator} did not skip ${r.skipViolations} null-expectation case(s)`
      )
      failed = true
    }
  }

  // A partial run must never read as a pass: the thresholds above only iterate
  // the evaluators that actually ran, so a no-key run trivially clears them.
  if (skippedReason) {
    console.log(
      `\nINCOMPLETE — ${results.length}/${expectedEvaluatorCount} evaluators measured (${skippedReason}). This is not a passing validation run.`
    )
  }

  if (failed || skippedReason) {
    process.exit(1)
  } else {
    console.log('\nAll evaluators passed validation thresholds.')
  }
}
