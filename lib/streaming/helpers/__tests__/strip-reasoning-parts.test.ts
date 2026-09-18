import { describe, expect, it } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import {
  needsReasoningStrip,
  stripReasoningParts,
  toReplaySafeAbortedMessage
} from '../strip-reasoning-parts'

const assistant = (parts: unknown[]): UIMessage =>
  ({ id: 'a1', role: 'assistant', parts }) as UIMessage

describe('stripReasoningParts', () => {
  const user = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }
  const reasoning = { type: 'reasoning', text: 'thinking', state: 'done' }
  const text = { type: 'text', text: 'answer' }

  it('removes reasoning parts and keeps the rest of the message', () => {
    const result = stripReasoningParts([
      user as UIMessage,
      assistant([reasoning, text])
    ])

    expect(result).toHaveLength(2)
    expect(result[1].parts).toEqual([text])
  })

  it('drops a completed reasoning-only assistant turn instead of replaying it', () => {
    const result = stripReasoningParts([
      user as UIMessage,
      assistant([reasoning]),
      user as UIMessage
    ])

    expect(result.map(m => m.role)).toEqual(['user', 'user'])
  })
})

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
  it('strips for OpenAI, DeepSeek and Z.ai via OpenRouter', () => {
    expect(needsReasoningStrip('openai:gpt-4.1')).toBe(true)
    expect(needsReasoningStrip('openrouter:deepseek/deepseek-v4-pro')).toBe(
      true
    )
    expect(needsReasoningStrip('openrouter:z-ai/glm-5.3-flash')).toBe(true)
    expect(needsReasoningStrip('openrouter:z-ai/glm-5.3')).toBe(true)
    expect(needsReasoningStrip('gateway:zai/glm-5.3-flash')).toBe(true)
  })

  it('leaves reasoning intact for every other model', () => {
    expect(needsReasoningStrip('gateway:google/gemini-3-flash')).toBe(false)
    expect(needsReasoningStrip('openrouter:anthropic/claude-sonnet-4')).toBe(
      false
    )
  })
})
