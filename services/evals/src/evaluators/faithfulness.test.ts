import type { LanguageModel } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEvaluate = vi.fn()

vi.mock('@arizeai/phoenix-evals', () => ({
  createFaithfulnessEvaluator: () => ({
    evaluate: mockEvaluate
  })
}))

import { createFaithfulnessExperimentEvaluator } from './faithfulness'

describe('faithfulness experiment evaluator', () => {
  const mockModel = {} as LanguageModel

  beforeEach(() => {
    mockEvaluate.mockReset()
  })

  it('has correct name and kind', () => {
    const evaluator = createFaithfulnessExperimentEvaluator(mockModel)
    expect(evaluator.name).toBe('faithfulness')
    expect(evaluator.kind).toBe('LLM')
  })

  it('skips when expectsRefusal is true', async () => {
    const evaluator = createFaithfulnessExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'harmful request', context: '' },
      output: 'I cannot help with that.',
      metadata: { expectsRefusal: true }
    })
    expect(result).toEqual({
      label: 'skipped',
      score: null,
      explanation: 'Refusal case — no search results expected'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('does not skip when expectsRefusal is false', async () => {
    mockEvaluate.mockResolvedValue({
      score: 1,
      label: 'faithful',
      explanation: 'grounded'
    })
    const evaluator = createFaithfulnessExperimentEvaluator(mockModel)
    await evaluator.evaluate({
      input: { query: 'test', context: 'some context' },
      output: 'answer',
      metadata: { expectsRefusal: false }
    })
    expect(mockEvaluate).toHaveBeenCalled()
  })

  it('skips when context is empty', async () => {
    const evaluator = createFaithfulnessExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'test question', context: '' },
      output: 'some answer'
    })
    expect(result).toEqual({
      label: 'skipped',
      score: null,
      explanation: 'Missing context or answer'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('skips when output is empty', async () => {
    const evaluator = createFaithfulnessExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'test', context: 'some context' },
      output: ''
    })
    expect(result).toEqual({
      label: 'skipped',
      score: null,
      explanation: 'Missing context or answer'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('skips when output is null', async () => {
    const evaluator = createFaithfulnessExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'test', context: 'some context' },
      output: null
    })
    expect(result).toEqual({
      label: 'skipped',
      score: null,
      explanation: 'Missing context or answer'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('maps fields to inner evaluator and returns result', async () => {
    mockEvaluate.mockResolvedValue({
      score: 1,
      label: 'faithful',
      explanation: 'all claims grounded'
    })
    const evaluator = createFaithfulnessExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: {
        query: 'what is AI?',
        context: 'AI is artificial intelligence.'
      },
      output: 'AI stands for artificial intelligence.'
    })
    expect(mockEvaluate).toHaveBeenCalledWith({
      input: 'what is AI?',
      retrievedSearchTopics: 'AI is artificial intelligence.',
      output: 'AI stands for artificial intelligence.'
    })
    expect(result).toEqual({
      score: 1,
      label: 'faithful',
      explanation: 'all claims grounded'
    })
  })
})
