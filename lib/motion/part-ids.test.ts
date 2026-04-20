import { describe, expect, it } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import { collectInitialPartIds, collectMessagePartIds } from './part-ids'

/** Build a UIMessage shell with the given parts. */
function buildMessage(id: string, parts: unknown[]): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: parts as UIMessage['parts']
  } as UIMessage
}

describe('collectMessagePartIds', () => {
  it('captures toolCallId from tool parts', () => {
    const msg = buildMessage('msg-1', [
      {
        type: 'tool-displayPlan',
        toolCallId: 'call-1',
        state: 'output-available'
      },
      { type: 'tool-search', toolCallId: 'call-2', state: 'output-available' }
    ])

    expect(collectMessagePartIds(msg)).toEqual(['call-1', 'call-2'])
  })

  it('captures text-extracted partIds matching the extractor format', () => {
    const timelineJson = JSON.stringify({
      id: 'tl-1',
      title: 'My Timeline',
      events: [{ id: 'e1', date: '2024-01-01', title: 'Kickoff' }]
    })
    const text = `Intro text.\n\n\`\`\`json\n${timelineJson}\n\`\`\`\n\nOutro.`
    const msg = buildMessage('msg-1', [{ type: 'text', text }])

    const ids = collectMessagePartIds(msg)

    // The extractor uses `${messageId}-extract-${match.index}` where
    // match.index is the offset of the opening ``` in the text.
    const expectedIndex = text.indexOf('```json')
    expect(ids).toContain(`msg-1-extract-${expectedIndex}`)
  })

  it('captures multiple json blocks with distinct match.index values', () => {
    const blockA = '```json\n{"a":1}\n```'
    const blockB = '```json\n{"b":2}\n```'
    const text = `${blockA}\n\nmiddle\n\n${blockB}`
    const msg = buildMessage('msg-2', [{ type: 'text', text }])

    const ids = collectMessagePartIds(msg)

    expect(ids).toContain(`msg-2-extract-${text.indexOf(blockA)}`)
    expect(ids).toContain(`msg-2-extract-${text.indexOf(blockB)}`)
  })

  it('returns empty array for messages with no parts', () => {
    const msg = buildMessage('msg-empty', [])
    expect(collectMessagePartIds(msg)).toEqual([])
  })

  it('combines toolCallId and text-extracted ids in one pass', () => {
    const text = 'before\n\n```json\n{"id":"x"}\n```'
    const msg = buildMessage('msg-3', [
      { type: 'tool-displayPlan', toolCallId: 'call-1' },
      { type: 'text', text }
    ])

    const ids = collectMessagePartIds(msg)

    expect(ids).toContain('call-1')
    expect(ids).toContain(`msg-3-extract-${text.indexOf('```json')}`)
  })

  it('is stable across repeated calls (regex lastIndex is reset)', () => {
    const text = '```json\n{"a":1}\n```'
    const msg = buildMessage('msg-4', [{ type: 'text', text }])

    const first = collectMessagePartIds(msg)
    const second = collectMessagePartIds(msg)

    expect(first).toEqual(second)
    expect(first.length).toBeGreaterThan(0)
  })
})

describe('collectInitialPartIds', () => {
  it('flattens ids across multiple messages', () => {
    const msgA = buildMessage('a', [
      { type: 'tool-displayPlan', toolCallId: 'call-a' }
    ])
    const msgB = buildMessage('b', [
      { type: 'tool-displayPlan', toolCallId: 'call-b' }
    ])

    expect(collectInitialPartIds([msgA, msgB])).toEqual(['call-a', 'call-b'])
  })

  it('returns empty array for an empty message list', () => {
    expect(collectInitialPartIds([])).toEqual([])
  })
})
