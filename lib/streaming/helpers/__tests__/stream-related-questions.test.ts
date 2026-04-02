import { beforeEach,describe, expect, it, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────

const mockCreateRelatedQuestionsStream = vi.fn()

vi.mock('@/lib/agents/generate-related-questions', () => ({
  createRelatedQuestionsStream: (...args: unknown[]) =>
    mockCreateRelatedQuestionsStream(...args)
}))

vi.mock('@/lib/db/schema', () => ({
  generateId: () => 'test-part-id'
}))

import { streamRelatedQuestions } from '../stream-related-questions'

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a minimal mock writer that captures all written parts. */
function createMockWriter() {
  const parts: Array<{ type: string; id?: string; data: unknown }> = []
  return {
    write(part: { type: string; id?: string; data: unknown }) {
      parts.push(structuredClone(part))
    },
    parts
  }
}

/** Build an async iterable that yields the given questions one at a time. */
async function* questionStream(
  questions: Array<{ question: string }>
): AsyncIterable<{ question: string }> {
  for (const q of questions) {
    yield q
  }
}

function mockStream(
  questions: Array<{ question: string }>,
  outputOverride?: unknown
) {
  mockCreateRelatedQuestionsStream.mockReturnValue({
    elementStream: questionStream(questions),
    output: Promise.resolve(outputOverride ?? questions)
  })
}

function mockStreamWithError(
  questions: Array<{ question: string }>,
  error: Error
) {
  mockCreateRelatedQuestionsStream.mockReturnValue({
    elementStream: questionStream(questions),
    output: Promise.reject(error)
  })
}

// ── Tests ────────────────────────────────────────────────────────────

describe('streamRelatedQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty when last message is not from assistant', async () => {
    const writer = createMockWriter()
    const result = await streamRelatedQuestions(writer as any, [
      { role: 'user', content: 'hello' }
    ])

    expect(result).toEqual({})
    expect(writer.parts).toHaveLength(0)
    expect(mockCreateRelatedQuestionsStream).not.toHaveBeenCalled()
  })

  it('returns empty when messages array is empty', async () => {
    const writer = createMockWriter()
    const result = await streamRelatedQuestions(writer as any, [])

    expect(result).toEqual({})
    expect(writer.parts).toHaveLength(0)
  })

  it('streams loading → streaming → success for 3 valid questions', async () => {
    const questions = [
      { question: 'What is X?' },
      { question: 'How does Y work?' },
      { question: 'Why is Z important?' }
    ]
    mockStream(questions)

    const writer = createMockWriter()
    const result = await streamRelatedQuestions(writer as any, [
      { role: 'assistant', content: 'response text' }
    ])

    // First write: loading
    expect(writer.parts[0]).toEqual({
      type: 'data-relatedQuestions',
      id: 'test-part-id',
      data: { status: 'loading' }
    })

    // Next 3 writes: streaming with incrementally growing array
    expect(writer.parts[1].data).toEqual({
      status: 'streaming',
      questions: [questions[0]]
    })
    expect(writer.parts[2].data).toEqual({
      status: 'streaming',
      questions: [questions[0], questions[1]]
    })
    expect(writer.parts[3].data).toEqual({
      status: 'streaming',
      questions: questions
    })

    // Final write: success
    const lastPart = writer.parts[writer.parts.length - 1]
    expect(lastPart.data).toEqual({
      status: 'success',
      questions
    })

    expect(result.questionPartId).toBe('test-part-id')
    expect(result.questions).toEqual(questions)
  })

  it('falls back to collected questions when output validation fails', async () => {
    const streamed = [{ question: 'A?' }, { question: 'B?' }]
    // Output returns 2 questions — relatedSchema.length(3) will reject
    mockStream(streamed, streamed)

    const writer = createMockWriter()
    const result = await streamRelatedQuestions(writer as any, [
      { role: 'assistant', content: 'text' }
    ])

    // Success still emitted with the 2 collected questions
    const lastPart = writer.parts[writer.parts.length - 1]
    expect(lastPart.data).toEqual({
      status: 'success',
      questions: streamed
    })
    expect(result.questions).toEqual(streamed)
  })

  it('falls back to collected questions when output promise rejects', async () => {
    const streamed = [
      { question: 'A?' },
      { question: 'B?' },
      { question: 'C?' }
    ]
    mockStreamWithError(streamed, new Error('output parse error'))

    const writer = createMockWriter()
    const result = await streamRelatedQuestions(writer as any, [
      { role: 'assistant', content: 'text' }
    ])

    const lastPart = writer.parts[writer.parts.length - 1]
    expect(lastPart.data).toEqual({
      status: 'success',
      questions: streamed
    })
    expect(result.questions).toEqual(streamed)
  })

  it('skips null/invalid questions during streaming', async () => {
    mockCreateRelatedQuestionsStream.mockReturnValue({
      elementStream: (async function* () {
        yield { question: 'Valid?' }
        yield null
        yield { question: 'Also valid?' }
        yield { notAQuestion: true }
      })(),
      output: Promise.resolve([
        { question: 'Valid?' },
        { question: 'Also valid?' }
      ])
    })

    const writer = createMockWriter()
    const result = await streamRelatedQuestions(writer as any, [
      { role: 'assistant', content: 'text' }
    ])

    // Only 2 streaming updates (nulls/invalid skipped)
    const streamingParts = writer.parts.filter(
      p => (p.data as any).status === 'streaming'
    )
    expect(streamingParts).toHaveLength(2)
    expect(result.questions).toHaveLength(2)
  })

  it('writes error state when elementStream itself throws', async () => {
    const rejectedOutput = Promise.reject(new Error('stream exploded'))
    // Prevent unhandled rejection — the code never reaches `await output`
    // because the elementStream throws first.
    rejectedOutput.catch(() => {})

    mockCreateRelatedQuestionsStream.mockReturnValue({
      elementStream: (async function* () {
        throw new Error('stream exploded')
      })(),
      output: rejectedOutput
    })

    const writer = createMockWriter()
    const result = await streamRelatedQuestions(writer as any, [
      { role: 'assistant', content: 'text' }
    ])

    // loading, then error
    expect(writer.parts[0].data).toEqual({ status: 'loading' })
    expect(writer.parts[1].data).toEqual({ status: 'error' })
    expect(result.questionPartId).toBe('test-part-id')
    expect(result.questions).toBeUndefined()
  })
})
