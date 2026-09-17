import { describe, expect, it } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import {
  needsReasoningStrip,
  toReplaySafeAbortedMessage
} from '../strip-reasoning-parts'

const assistant = (parts: unknown[]): UIMessage =>
  ({ id: 'a1', role: 'assistant', parts }) as UIMessage

describe('toReplaySafeAbortedMessage', () => {
  it('drops a reasoning-only aborted message', () => {
    expect(
      toReplaySafeAbortedMessage(
        assistant([{ type: 'reasoning', text: 'thinking', state: 'streaming' }])
      )
    ).toBeNull()
  })

  it('keeps partial text and settled tools, drops unfinished tool calls', () => {
    const result = toReplaySafeAbortedMessage(
      assistant([
        {
          type: 'tool-search',
          toolCallId: 'c1',
          state: 'output-available',
          input: {},
          output: {}
        },
        { type: 'tool-fetch', toolCallId: 'c2', state: 'input-available' },
        { type: 'text', text: 'Partial answer', state: 'streaming' }
      ])
    )
    expect(result?.parts.map(p => p.type)).toEqual(['tool-search', 'text'])
  })

  it('drops a message whose only tool call never settled', () => {
    expect(
      toReplaySafeAbortedMessage(
        assistant([
          { type: 'tool-search', toolCallId: 'c1', state: 'input-streaming' }
        ])
      )
    ).toBeNull()
  })
})

describe('needsReasoningStrip', () => {
  it('strips for OpenAI and DeepSeek-via-OpenRouter models', () => {
    expect(needsReasoningStrip('openai:gpt-4.1')).toBe(true)
    expect(needsReasoningStrip('openrouter:deepseek/deepseek-v4-pro')).toBe(
      true
    )
  })

  it('leaves reasoning intact for every other model', () => {
    expect(needsReasoningStrip('gateway:google/gemini-3-flash')).toBe(false)
    expect(needsReasoningStrip('openrouter:anthropic/claude-sonnet-4')).toBe(
      false
    )
  })
})
