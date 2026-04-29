import { describe, expect, it } from 'vitest'

import { createCitationAccuracyExperimentEvaluator } from '../evaluators/citation-accuracy'
import { createSafetyExperimentEvaluator } from '../evaluators/safety'
import { createToolUsageExperimentEvaluator } from '../evaluators/tool-usage'
import { evaluatePrechecks } from '../prechecks'

import { buildEvalOutput, getGoldenExamples } from './index'

describe('prechecks golden validation', () => {
  const examples = getGoldenExamples()

  for (const example of examples) {
    it(`correctly evaluates ${example.id}`, () => {
      const result = evaluatePrechecks(buildEvalOutput(example), {
        requiresTextAnswer: example.requiresTextAnswer,
        requiresCitations: example.requiresCitations,
        allowsInteractiveOnly: example.allowsInteractiveOnly
      })
      expect(result.label).toBe(example.expected.prechecks.label)
      expect(result.score).toBe(example.expected.prechecks.score)
    })
  }
})

describe('tool-usage golden validation', () => {
  const examples = getGoldenExamples()
  const evaluator = createToolUsageExperimentEvaluator()

  for (const example of examples) {
    const expected = example.expected.tool_usage
    if (expected === null) continue

    it(`correctly evaluates ${example.id}`, async () => {
      const result = await evaluator.evaluate({
        input: { query: example.query, context: example.context },
        output: buildEvalOutput(example),
        metadata: {
          requiresCitations: example.requiresCitations
        }
      })
      expect(result.label).toBe(expected.label)
      expect(result.score).toBe(expected.score)
    })
  }
})

describe('safety golden validation deterministic skips', () => {
  const examples = getGoldenExamples().filter(
    example => example.expected.safety === null
  )
  const evaluator = createSafetyExperimentEvaluator({} as any)

  for (const example of examples) {
    it(`skips ${example.id}`, async () => {
      const result = await evaluator.evaluate({
        input: { query: example.query },
        output: buildEvalOutput(example)
      })
      expect(result.label).toBe('skipped')
      expect(result.score).toBeNull()
    })
  }
})

describe('citation-accuracy golden validation deterministic skips', () => {
  const examples = getGoldenExamples().filter(
    example => example.expected.citation_accuracy === null
  )
  const evaluator = createCitationAccuracyExperimentEvaluator({} as any)

  for (const example of examples) {
    it(`skips ${example.id}`, async () => {
      const result = await evaluator.evaluate({
        input: { prompt: example.query, context: example.context },
        output: buildEvalOutput(example)
      })
      expect(result.label).toBe('skipped')
      expect(result.score).toBeNull()
    })
  }
})

describe('citation-accuracy golden search context', () => {
  const examples = getGoldenExamples().filter(
    example =>
      example.citations.length > 0 &&
      example.expected.citation_accuracy !== null
  )

  it('provides search results for cited examples that expect citation scoring', () => {
    expect(examples.length).toBeGreaterThan(0)

    for (const example of examples) {
      const output = buildEvalOutput(example)

      expect(output.searchResults.length, example.id).toBeGreaterThan(0)
      expect(
        output.searchResults.some(
          searchResult => searchResult.results.length > 0
        ),
        example.id
      ).toBe(true)
    }
  })
})
