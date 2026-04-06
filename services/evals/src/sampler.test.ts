import { describe, expect, it, vi } from 'vitest'

vi.mock('./config', () => ({
  config: {
    sampleSize: 50,
    lookbackHours: 6
  }
}))

vi.mock('./db', () => ({
  db: { execute: vi.fn() }
}))

vi.mock('./retry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn())
}))

import { parseCitations, parseSearchResults, parseToolNames } from './sampler'

describe('parseToolNames', () => {
  it('returns parsed array for valid JSON', () => {
    expect(parseToolNames('["search","fetch"]')).toEqual(['search', 'fetch'])
  })

  it('returns empty array for null', () => {
    expect(parseToolNames(null)).toEqual([])
  })

  it('filters out non-string entries', () => {
    expect(parseToolNames('[1, "search", null, ""]')).toEqual(['search'])
  })

  it('throws SamplerParseError for malformed JSON', () => {
    expect(() => parseToolNames('{not valid')).toThrow('SamplerParseError')
  })
})

describe('parseCitations', () => {
  it('returns parsed citations for valid JSON', () => {
    const raw = JSON.stringify([{ url: 'https://a.com', title: 'A' }])
    expect(parseCitations(raw)).toEqual([{ url: 'https://a.com', title: 'A' }])
  })

  it('returns empty array for null', () => {
    expect(parseCitations(null)).toEqual([])
  })

  it('throws SamplerParseError for malformed JSON', () => {
    expect(() => parseCitations('{garbage')).toThrow('SamplerParseError')
  })
})

describe('parseSearchResults', () => {
  it('returns parsed results for valid JSON', () => {
    const raw = JSON.stringify([
      {
        query: 'test',
        results: [{ title: 'T', url: 'https://t.com', snippet: 'snip' }]
      }
    ])
    const result = parseSearchResults(raw)
    expect(result).toHaveLength(1)
    expect(result[0].query).toBe('test')
    expect(result[0].results[0].title).toBe('T')
  })

  it('returns empty array for null', () => {
    expect(parseSearchResults(null)).toEqual([])
  })

  it('throws SamplerParseError for malformed JSON', () => {
    expect(() => parseSearchResults('not json')).toThrow('SamplerParseError')
  })
})
