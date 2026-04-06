import { describe, expect, it } from 'vitest'

import { createCitationAccuracyExperimentEvaluator } from './citation-accuracy'

describe('citation-accuracy evaluator', () => {
  it('returns null when no citations present', async () => {
    const evaluator = createCitationAccuracyExperimentEvaluator({} as any)
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
  })

  it('returns 0.5 when no search results to cross-reference', async () => {
    const evaluator = createCitationAccuracyExperimentEvaluator({} as any)
    const result = await evaluator.evaluate({
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
    })

    expect(result.label).toBe('no_search_context')
    expect(result.score).toBe(0.5)
  })
})
