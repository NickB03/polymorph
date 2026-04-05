import { describe, expect, it } from 'vitest'

import { createToolUsageExperimentEvaluator } from './tool-usage'

describe('createToolUsageExperimentEvaluator', () => {
  const evaluator = createToolUsageExperimentEvaluator()

  const makeOutput = (toolNames: string[]) => ({
    answerText: 'some answer',
    citations: [],
    searchResults: [],
    toolNames,
    usedInteractiveOnlyOutput: false,
    modelId: 'test',
    durationMs: 100
  })

  it('returns score 0 when citations required but no tools used', async () => {
    const result = await evaluator.evaluate({
      input: { query: 'test' },
      output: makeOutput([]),
      metadata: { requiresCitations: true }
    })
    expect(result).toMatchObject({
      label: 'missing_tools',
      score: 0
    })
  })

  it('returns score 1 when tools were used', async () => {
    const result = await evaluator.evaluate({
      input: { query: 'test' },
      output: makeOutput(['search', 'fetch']),
      metadata: { requiresCitations: true }
    })
    expect(result).toMatchObject({
      label: 'tools_used',
      score: 1
    })
  })

  it('returns null score when tool usage is indeterminate', async () => {
    const result = await evaluator.evaluate({
      input: { query: 'hello' },
      output: makeOutput([]),
      metadata: { requiresCitations: false }
    })
    expect(result).toMatchObject({
      label: 'skipped',
      score: null
    })
  })

  it('passes when tools used even without citation requirement', async () => {
    const result = await evaluator.evaluate({
      input: { query: 'test' },
      output: makeOutput(['search']),
      metadata: { requiresCitations: false }
    })
    expect(result).toMatchObject({
      label: 'tools_used',
      score: 1
    })
  })

  it('handles missing metadata gracefully', async () => {
    const result = await evaluator.evaluate({
      input: { query: 'test' },
      output: makeOutput([]),
      metadata: null
    })
    expect(result).toMatchObject({
      label: 'skipped',
      score: null
    })
  })
})
