import { type ModelMessage, type UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  convertMessageForDB,
  convertMessagesForDB,
  extractTitleFromMessage,
  getTextFromParts,
  hasToolCalls,
  mergeUIMessages
} from '../message-utils'

describe('convertMessageForDB', () => {
  it('handles string content', () => {
    const msg = { role: 'user', content: 'hello' } as ModelMessage
    const result = convertMessageForDB(msg)
    expect(result).toEqual({ role: 'user', parts: [{ text: 'hello' }] })
  })

  it('handles null content', () => {
    const msg = { role: 'assistant', content: null } as unknown as ModelMessage
    const result = convertMessageForDB(msg)
    expect(result).toEqual({ role: 'assistant', parts: [] })
  })

  it('handles undefined content', () => {
    const msg = {
      role: 'assistant',
      content: undefined
    } as unknown as ModelMessage
    const result = convertMessageForDB(msg)
    expect(result).toEqual({ role: 'assistant', parts: [] })
  })

  it('extracts text parts from array content', () => {
    const msg = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'hello' },
        { type: 'tool-call', toolCallId: '1', toolName: 'search', args: {} },
        { type: 'text', text: 'world' }
      ]
    } as ModelMessage
    const result = convertMessageForDB(msg)
    expect(result).toEqual({
      role: 'assistant',
      parts: [{ text: 'hello' }, { text: 'world' }]
    })
  })

  it('stringifies array content when no text parts exist', () => {
    const content = [
      { type: 'tool-call', toolCallId: '1', toolName: 'search', args: {} }
    ]
    const msg = { role: 'assistant', content } as unknown as ModelMessage
    const result = convertMessageForDB(msg)
    expect(result.parts).toHaveLength(1)
    expect(result.parts[0].text).toBe(JSON.stringify(content))
  })

  it('stringifies non-array non-string content', () => {
    const msg = { role: 'user', content: 42 } as unknown as ModelMessage
    const result = convertMessageForDB(msg)
    expect(result.parts).toEqual([{ text: '42' }])
  })
})

describe('convertMessagesForDB', () => {
  it('converts an array of messages', () => {
    const msgs = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hey' }
    ] as ModelMessage[]
    const result = convertMessagesForDB(msgs)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ role: 'user', parts: [{ text: 'hi' }] })
    expect(result[1]).toEqual({ role: 'assistant', parts: [{ text: 'hey' }] })
  })
})

describe('extractTitleFromMessage', () => {
  it('extracts from string content', () => {
    const msg = { role: 'user', content: 'Hello world' } as ModelMessage
    expect(extractTitleFromMessage(msg)).toBe('Hello world')
  })

  it('truncates at maxLength', () => {
    const msg = { role: 'user', content: 'a'.repeat(200) } as ModelMessage
    expect(extractTitleFromMessage(msg, 50)).toHaveLength(50)
  })

  it('returns "New Chat" for null content', () => {
    const msg = { role: 'user', content: null } as unknown as ModelMessage
    expect(extractTitleFromMessage(msg)).toBe('New Chat')
  })

  it('extracts text from array content', () => {
    const msg = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Generated title' }]
    } as ModelMessage
    expect(extractTitleFromMessage(msg)).toBe('Generated title')
  })

  it('returns "New Chat" when array has no text parts', () => {
    const msg = {
      role: 'assistant',
      content: [{ type: 'tool-call', toolCallId: '1', toolName: 'x', args: {} }]
    } as unknown as ModelMessage
    expect(extractTitleFromMessage(msg)).toBe('New Chat')
  })
})

describe('getTextFromParts', () => {
  it('returns empty string for undefined parts', () => {
    expect(getTextFromParts(undefined)).toBe('')
  })

  it('returns empty string for empty parts', () => {
    expect(getTextFromParts([])).toBe('')
  })

  it('extracts and joins text parts', () => {
    const parts = [
      { type: 'text' as const, text: 'hello' },
      { type: 'text' as const, text: 'world' }
    ]
    expect(getTextFromParts(parts as UIMessage['parts'])).toBe('hello world')
  })

  it('ignores non-text parts', () => {
    const parts = [
      { type: 'text' as const, text: 'hello' },
      { type: 'reasoning' as const, text: 'thinking...' }
    ]
    expect(getTextFromParts(parts as UIMessage['parts'])).toBe('hello')
  })
})

describe('mergeUIMessages', () => {
  it('combines parts from both messages', () => {
    const primary = {
      id: '1',
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, text: 'a' }]
    } as UIMessage
    const secondary = {
      id: '2',
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, text: 'b' }]
    } as UIMessage

    const merged = mergeUIMessages(primary, secondary)
    expect(merged.id).toBe('1') // preserves primary
    expect(merged.parts).toHaveLength(2)
  })
})

describe('hasToolCalls', () => {
  it('returns false for null message', () => {
    expect(hasToolCalls(null)).toBe(false)
  })

  it('returns false for message without tool calls', () => {
    const msg = {
      id: '1',
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, text: 'hi' }]
    } as UIMessage
    expect(hasToolCalls(msg)).toBe(false)
  })

  it('returns true for message with tool-call part', () => {
    const msg = {
      id: '1',
      role: 'assistant' as const,
      parts: [
        { type: 'text' as const, text: 'hi' },
        {
          type: 'tool-call' as const,
          toolCallId: '1',
          toolName: 'search',
          args: {},
          state: 'result' as const,
          result: {}
        }
      ]
    } as UIMessage
    expect(hasToolCalls(msg)).toBe(true)
  })

  it('returns true for tool-result parts', () => {
    const msg = {
      id: '1',
      role: 'assistant' as const,
      parts: [{ type: 'tool-result' as const }]
    } as unknown as UIMessage
    expect(hasToolCalls(msg)).toBe(true)
  })
})
