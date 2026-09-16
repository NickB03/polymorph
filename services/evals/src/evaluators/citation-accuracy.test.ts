import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGenerateObject = vi.fn()

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args)
}))

import {
  CITATION_LABEL_SCORES,
  createCitationAccuracyExperimentEvaluator
} from './citation-accuracy'

const fakeModel = {} as never

const inputWithCitationsAndResults = {
  input: {
    prompt: 'What is the capital of France?',
    context: '',
    tags: []
  },
  output: {
    answerText: 'The capital of France is Paris [1].',
    citations: [{ url: 'https://example.com', title: 'Example' }],
    searchResults: [
      {
        query: 'capital of France',
        results: [
          {
            title: 'Example',
            url: 'https://example.com',
            snippet: 'Paris is the capital of France.'
          }
        ]
      }
    ],
    toolNames: ['search'],
    usedInteractiveOnlyOutput: false,
    modelId: '',
    durationMs: 0
  },
  metadata: {
    caseId: 'test-1',
    suite: 'capability' as const,
    tags: [],
    corpusVersion: 'v5',
    requiresTextAnswer: true,
    requiresCitations: true,
    allowsInteractiveOnly: false
  }
}

const inputWithCitationsButNoResults = {
  input: {
    prompt: 'test',
    context: '',
    tags: []
  },
  output: {
    answerText: 'An answer with a citation',
    citations: [{ url: 'https://example.com', title: 'Example' }],
    searchResults: [],
    toolNames: [],
    usedInteractiveOnlyOutput: false,
    modelId: '',
    durationMs: 0
  },
  metadata: {
    caseId: 'test-2',
    suite: 'capability' as const,
    tags: [],
    corpusVersion: 'v5',
    requiresTextAnswer: true,
    requiresCitations: true,
    allowsInteractiveOnly: false
  }
}

describe('citation-accuracy evaluator', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset()
  })

  it('returns null when no citations present', async () => {
    const evaluator = createCitationAccuracyExperimentEvaluator(fakeModel)
    const result = await evaluator.evaluate({
      input: {
        prompt: 'test',
        context: 'some context',
        tags: []
      },
      output: {
        answerText: 'An answer without citations',
        citations: [],
        searchResults: [],
        toolNames: ['search'],
        usedInteractiveOnlyOutput: false,
        modelId: '',
        durationMs: 0
      },
      metadata: {
        caseId: 'test-1',
        suite: 'capability' as const,
        tags: [],
        corpusVersion: 'v5',
        requiresTextAnswer: true,
        requiresCitations: false,
        allowsInteractiveOnly: false
      }
    })

    expect(result.label).toBe('skipped')
    expect(result.score).toBeNull()
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })

  it('derives score from label and never trusts judge-emitted score', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        label: 'mixed',
        explanation: 'Some citations fabricated',
        score: 0.9
      }
    })
    const evaluator = createCitationAccuracyExperimentEvaluator(fakeModel)
    const result = await evaluator.evaluate(
      inputWithCitationsAndResults as never
    )
    expect(result.label).toBe('mixed')
    expect(result.score).toBe(0.4)
  })

  it('maps every label to its fixed score', () => {
    expect(CITATION_LABEL_SCORES).toEqual({
      accurate: 1,
      mostly_accurate: 0.75,
      mixed: 0.4,
      mostly_inaccurate: 0.25,
      fabricated: 0
    })
  })

  it('returns null score when citations cannot be verified against search results', async () => {
    const evaluator = createCitationAccuracyExperimentEvaluator(fakeModel)
    const result = await evaluator.evaluate(
      inputWithCitationsButNoResults as never
    )
    expect(result.label).toBe('no_search_context')
    expect(result.score).toBeNull()
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })
})
