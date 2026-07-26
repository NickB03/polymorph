import { describe, expect, it } from 'vitest'

import { formatEvalContext } from '../eval-output'
import { createCitationAccuracyExperimentEvaluator } from '../evaluators/citation-accuracy'
import { createRelevanceExperimentEvaluator } from '../evaluators/relevance'
import { createSafetyExperimentEvaluator } from '../evaluators/safety'
import { createToolUsageExperimentEvaluator } from '../evaluators/tool-usage'
import { evaluatePrechecks } from '../prechecks'

import { buildEvalOutput, getGoldenExamples } from './index'
import { runEval } from './validate'

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

describe('relevance golden validation deterministic no-search outcomes', () => {
  const examples = getGoldenExamples().filter(example => !example.context)
  const evaluator = createRelevanceExperimentEvaluator({} as any)

  it('keeps both a skip case and a no_results true-negative case', () => {
    expect(examples.some(example => example.expected.relevance === null)).toBe(
      true
    )
    expect(
      examples.some(
        example => example.expected.relevance?.label === 'no_results'
      )
    ).toBe(true)
  })

  for (const example of examples) {
    const expected = example.expected.relevance

    it(`correctly evaluates ${example.id}`, async () => {
      const result = await evaluator.evaluate({
        input: { query: example.query, context: example.context },
        output: buildEvalOutput(example),
        metadata: {
          requiresCitations: example.requiresCitations
        }
      })
      if (expected === null) {
        expect(result.label).toBe('skipped')
        expect(result.score).toBeNull()
      } else {
        expect(result.label).toBe(expected.label)
        expect(result.score).toBe(expected.score)
      }
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

describe('production-shaped adversarial golden coverage', () => {
  const examples = getGoldenExamples()

  it('emits non-empty search results for every tool-using example', () => {
    for (const example of examples) {
      if (example.toolNames.length === 0) continue
      const output = buildEvalOutput(example)
      expect(
        output.searchResults.some(
          searchResult => searchResult.results.length > 0
        ),
        example.id
      ).toBe(true)
    }
  })

  it('splits derived search results into short multi-result snippets', () => {
    const derived = examples.find(
      example => example.id === 'tp-tool-search-fetch' && !example.searchResults
    )
    expect(
      derived,
      'tp-tool-search-fetch should derive its search results'
    ).toBeDefined()

    const output = buildEvalOutput(derived!)
    const items = output.searchResults.flatMap(group => group.results)
    expect(items.length).toBeGreaterThan(1)
    for (const item of items) {
      expect(
        item.snippet.length,
        `${derived!.id} snippet length`
      ).toBeLessThanOrEqual(300)
    }
  })

  it('includes at least three off-topic relevance true-negative cases', () => {
    const unrelated = examples.filter(
      example => example.expected.relevance?.label === 'unrelated'
    )
    expect(unrelated.length).toBeGreaterThanOrEqual(3)
  })

  it('includes at least one fabricated-citation case', () => {
    const fabricated = examples.filter(
      example => example.expected.citation_accuracy?.label === 'fabricated'
    )
    expect(fabricated.length).toBeGreaterThanOrEqual(1)
  })

  it('runEval passes production-shaped context, not the raw example prose', async () => {
    // tp-factual-grounded has citations, so its derived context is a
    // `- [title](url): snippet` list — provably different from its prose
    // `context` field.
    const example = getGoldenExamples().find(
      candidate => candidate.id === 'tp-factual-grounded'
    )
    expect(example, 'tp-factual-grounded should exist').toBeDefined()

    const expectedContext = formatEvalContext(buildEvalOutput(example!))
    expect(expectedContext).not.toBe(example!.context)
    expect(expectedContext).toContain('- [Speed of light - Wikipedia](')

    const calls: Array<{
      input: Record<string, unknown>
      metadata: Record<string, unknown>
    }> = []
    const stubEvaluator = {
      evaluate: (args: any) => {
        calls.push({ input: args.input, metadata: args.metadata })
        return { label: 'faithful', score: 1 }
      }
    }

    const result = await runEval(stubEvaluator)(example!)

    expect(result).toEqual({ label: 'faithful', score: 1 })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.input.context).toBe(expectedContext)
    expect(calls[0]!.input.context).not.toBe(example!.context)
    expect(calls[0]!.input.query).toBe(example!.query)
    expect(calls[0]!.input.prompt).toBe(example!.query)
    expect(calls[0]!.metadata).toEqual({
      requiresCitations: example!.requiresCitations,
      expectsRefusal: example!.expectsRefusal
    })
  })

  it('includes both a refused and a complied refusal case', () => {
    const refusalCases = examples.filter(example => example.expectsRefusal)
    expect(
      refusalCases.some(
        example => example.expected.refusal?.label === 'refused'
      )
    ).toBe(true)
    expect(
      refusalCases.some(
        example => example.expected.refusal?.label === 'complied'
      )
    ).toBe(true)
  })
})
