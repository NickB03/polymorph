import { describe, expect, it } from 'vitest'

import { createDeterministicPrecheckEvaluator } from './prechecks'

describe('deterministic prechecks', () => {
  it('fails when a required text answer is missing', async () => {
    const evaluator = createDeterministicPrecheckEvaluator()

    const result = await evaluator.evaluate({
      input: { caseId: 'case-1' },
      output: {
        answerText: '',
        citations: [],
        searchResults: [],
        toolNames: [],
        usedInteractiveOnlyOutput: false,
        modelId: 'model',
        durationMs: 10
      },
      metadata: {
        requiresTextAnswer: true,
        requiresCitations: false,
        allowsInteractiveOnly: true
      }
    })

    expect(result.label).toBe('missing_answer')
    expect(result.score).toBe(0)
  })

  it('fails when citations are required but missing', async () => {
    const evaluator = createDeterministicPrecheckEvaluator()

    const result = await evaluator.evaluate({
      input: { caseId: 'case-2' },
      output: {
        answerText: 'answer',
        citations: [],
        searchResults: [],
        toolNames: [],
        usedInteractiveOnlyOutput: false,
        modelId: 'model',
        durationMs: 10
      },
      metadata: {
        requiresTextAnswer: true,
        requiresCitations: true,
        allowsInteractiveOnly: true
      }
    })

    expect(result.label).toBe('missing_citations')
    expect(result.score).toBe(0)
  })

  it('fails when interactive-only output is disallowed', async () => {
    const evaluator = createDeterministicPrecheckEvaluator()

    const result = await evaluator.evaluate({
      input: { caseId: 'case-3' },
      output: {
        answerText: '',
        citations: [],
        searchResults: [],
        toolNames: ['displayTable'],
        usedInteractiveOnlyOutput: true,
        modelId: 'model',
        durationMs: 10
      },
      metadata: {
        requiresTextAnswer: true,
        requiresCitations: false,
        allowsInteractiveOnly: false
      }
    })

    expect(result.label).toBe('interactive_only_output')
    expect(result.score).toBe(0)
  })

  it('passes when no citations required and none present', async () => {
    const evaluator = createDeterministicPrecheckEvaluator()

    const result = await evaluator.evaluate({
      input: { caseId: 'case-4' },
      output: {
        answerText: 'answer',
        citations: [],
        searchResults: [],
        toolNames: [],
        usedInteractiveOnlyOutput: false,
        modelId: 'model',
        durationMs: 10
      },
      metadata: {
        requiresTextAnswer: true,
        requiresCitations: false,
        allowsInteractiveOnly: true
      }
    })

    expect(result.label).toBe('pass')
    expect(result.score).toBe(1)
  })

  it('uses safe defaults when metadata is missing', async () => {
    const evaluator = createDeterministicPrecheckEvaluator()

    const result = await evaluator.evaluate({
      input: { caseId: 'case-5' },
      output: {
        answerText: 'answer',
        citations: [],
        searchResults: [],
        toolNames: [],
        usedInteractiveOnlyOutput: false,
        modelId: 'model',
        durationMs: 10
      }
    })

    expect(result.label).toBe('pass')
    expect(result.score).toBe(1)
  })
})
