import type { LanguageModel } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEvaluate = vi.fn()

vi.mock('@arizeai/phoenix-evals', () => ({
  createClassificationEvaluator: () => ({
    evaluate: mockEvaluate
  })
}))

import { createResponseQualityExperimentEvaluator } from './response-quality'

describe('response quality experiment evaluator', () => {
  const mockModel = {} as LanguageModel

  beforeEach(() => {
    mockEvaluate.mockReset()
  })

  it('has correct name and kind', () => {
    const evaluator = createResponseQualityExperimentEvaluator(mockModel)
    expect(evaluator.name).toBe('response_quality')
    expect(evaluator.kind).toBe('LLM')
  })

  it('skips when expectsRefusal is true', async () => {
    const evaluator = createResponseQualityExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'harmful request', context: '' },
      output: 'I cannot help with that.',
      metadata: { expectsRefusal: true }
    })
    expect(result).toEqual({
      label: 'skipped',
      score: null,
      explanation: 'Refusal case — quality assessed by safety evaluator'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('skips when output is empty', async () => {
    const evaluator = createResponseQualityExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'test question', context: 'some context' },
      output: ''
    })
    expect(result).toEqual({
      label: 'no_answer',
      score: 0.0,
      explanation: 'No answer generated'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('skips when output is null', async () => {
    const evaluator = createResponseQualityExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'test', context: '' },
      output: null
    })
    expect(result).toEqual({
      label: 'no_answer',
      score: 0.0,
      explanation: 'No answer generated'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('maps fields to inner evaluator', async () => {
    mockEvaluate.mockResolvedValue({
      score: 0.75,
      label: 'good',
      explanation: 'comprehensive and well-structured'
    })
    const evaluator = createResponseQualityExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: {
        query: 'explain quantum computing',
        context: 'quantum computing uses qubits...'
      },
      output: 'Quantum computing leverages qubits...'
    })
    expect(mockEvaluate).toHaveBeenCalledWith({
      query: 'explain quantum computing',
      context: 'quantum computing uses qubits...',
      answer: 'Quantum computing leverages qubits...'
    })
    expect(result).toEqual({
      score: 0.75,
      label: 'good',
      explanation: 'comprehensive and well-structured'
    })
  })

  it('passes empty context when context is missing', async () => {
    mockEvaluate.mockResolvedValue({
      score: 0,
      label: 'fail',
      explanation: 'lacks substance without context'
    })
    const evaluator = createResponseQualityExperimentEvaluator(mockModel)
    await evaluator.evaluate({
      input: { query: 'hello' },
      output: 'Hi there!'
    })
    expect(mockEvaluate).toHaveBeenCalledWith({
      query: 'hello',
      context: '',
      answer: 'Hi there!'
    })
  })
})
