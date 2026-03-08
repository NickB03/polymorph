import { describe, expect, it, vi } from 'vitest'

// Mock dependencies before importing
vi.mock('ai', () => ({
  generateText: vi.fn()
}))

vi.mock('@/lib/utils/registry', () => ({
  getModel: vi.fn().mockReturnValue('mock-model')
}))

vi.mock('@/lib/utils/telemetry', () => ({
  isTracingEnabled: vi.fn().mockReturnValue(false)
}))

import { generateText } from 'ai'

import { generateChatTitle } from '../title-generator'

const mockGenerateText = vi.mocked(generateText)

describe('generateChatTitle', () => {
  it('returns the generated title on success', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'AI Research Tools'
    } as any)

    const title = await generateChatTitle({
      userMessageContent: 'What are the best AI research tools?',
      modelId: 'test-model'
    })
    expect(title).toBe('AI Research Tools')
  })

  it('strips surrounding quotes from generated title', async () => {
    mockGenerateText.mockResolvedValue({
      text: '"Quoted Title"'
    } as any)

    const title = await generateChatTitle({
      userMessageContent: 'test',
      modelId: 'test-model'
    })
    expect(title).toBe('Quoted Title')
  })

  it('strips single quotes too', async () => {
    mockGenerateText.mockResolvedValue({
      text: "'Single Quoted'"
    } as any)

    const title = await generateChatTitle({
      userMessageContent: 'test',
      modelId: 'test-model'
    })
    expect(title).toBe('Single Quoted')
  })

  it('trims whitespace from generated title', async () => {
    mockGenerateText.mockResolvedValue({
      text: '  Spaced Title  '
    } as any)

    const title = await generateChatTitle({
      userMessageContent: 'test',
      modelId: 'test-model'
    })
    expect(title).toBe('Spaced Title')
  })

  it('returns fallback when LLM returns empty string', async () => {
    mockGenerateText.mockResolvedValue({
      text: ''
    } as any)

    const title = await generateChatTitle({
      userMessageContent: 'Hello world',
      modelId: 'test-model'
    })
    expect(title).toBe('Hello world')
  })

  it('returns fallback truncated to 75 chars on empty generation', async () => {
    mockGenerateText.mockResolvedValue({
      text: '   '
    } as any)

    const longMessage = 'A'.repeat(100)
    const title = await generateChatTitle({
      userMessageContent: longMessage,
      modelId: 'test-model'
    })
    expect(title).toBe('A'.repeat(75))
  })

  it('returns "New Chat" when message is empty and LLM fails', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'))

    const title = await generateChatTitle({
      userMessageContent: '',
      modelId: 'test-model'
    })
    expect(title).toBe('New Chat')
  })

  it('returns fallback on AbortError', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    mockGenerateText.mockRejectedValue(abortError)

    const title = await generateChatTitle({
      userMessageContent: 'Some question',
      modelId: 'test-model'
    })
    expect(title).toBe('Some question')
  })

  it('returns fallback on ResponseAborted error', async () => {
    const abortError = new Error('Response aborted')
    abortError.name = 'ResponseAborted'
    mockGenerateText.mockRejectedValue(abortError)

    const title = await generateChatTitle({
      userMessageContent: 'My query',
      modelId: 'test-model'
    })
    expect(title).toBe('My query')
  })

  it('returns fallback on generic error', async () => {
    mockGenerateText.mockRejectedValue(new Error('Network failure'))

    const title = await generateChatTitle({
      userMessageContent: 'What is TypeScript?',
      modelId: 'test-model'
    })
    expect(title).toBe('What is TypeScript?')
  })
})
