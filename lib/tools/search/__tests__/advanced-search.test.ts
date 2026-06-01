import { describe, expect, it } from 'vitest'

import type { SearXNGResult } from '@/lib/types'

import {
  calculateRelevanceScore,
  extractPublicationDate,
  highlightQueryTerms,
  isQualityContent
} from '../advanced-search'

function result(overrides: Partial<SearXNGResult> = {}): SearXNGResult {
  return {
    title: 'bar',
    url: 'https://example.com',
    content: 'foo foo foo',
    ...overrides
  }
}

function parseDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('highlightQueryTerms', () => {
  it('wraps whole-word matches in <mark>, case-insensitively', () => {
    expect(highlightQueryTerms('Climate change is real', 'climate')).toBe(
      '<mark>Climate</mark> change is real'
    )
  })

  it('ignores terms of two characters or fewer', () => {
    // "a" is length 1 and is filtered out, so the content is unchanged
    expect(highlightQueryTerms('a big cat', 'a')).toBe('a big cat')
  })

  it('does not throw on regex metacharacters in the query', () => {
    expect(() => highlightQueryTerms('hello (world)', '(world)')).not.toThrow()
    expect(typeof highlightQueryTerms('hello (world)', '(world)')).toBe(
      'string'
    )
  })

  it('returns the input unchanged when content is not a string (catch branch)', () => {
    expect(highlightQueryTerms(null as unknown as string, 'foo')).toBeNull()
  })
})

describe('calculateRelevanceScore', () => {
  it('scores full-query + per-word content matches minus the short-content penalty', () => {
    // +30 (content includes "foo") + 3*3 (three \bfoo\b matches) - 10 (len < 200) = 29
    expect(calculateRelevanceScore(result(), 'foo')).toBe(29)
  })

  it('applies title bonuses', () => {
    // content has no match; title === "foo": +20 (includes) +10 (word) -10 (short) = 20
    expect(
      calculateRelevanceScore(result({ content: 'x', title: 'foo' }), 'foo')
    ).toBe(20)
  })

  it('adds a recency bonus for recently published results', () => {
    const recent = calculateRelevanceScore(
      result({ publishedDate: new Date().toISOString() }),
      'foo'
    )
    const old = calculateRelevanceScore(
      result({
        publishedDate: new Date(
          Date.now() - 400 * 24 * 3600 * 1000
        ).toISOString()
      }),
      'foo'
    )
    // recent (<30 days) earns +15 over an entry older than a year
    expect(recent).toBe(29 + 15)
    expect(old).toBe(29)
  })

  it('returns 0 when scoring throws (malformed result)', () => {
    expect(
      calculateRelevanceScore(null as unknown as SearXNGResult, 'foo')
    ).toBe(0)
  })
})

describe('extractPublicationDate', () => {
  it('reads an article:published_time meta tag', () => {
    const doc = parseDoc(
      '<meta property="article:published_time" content="2024-01-15T00:00:00Z">'
    )
    const date = extractPublicationDate(doc)
    expect(date?.getUTCFullYear()).toBe(2024)
  })

  it('reads a <time datetime> element', () => {
    const doc = parseDoc('<time datetime="2023-05-20">May 20</time>')
    expect(extractPublicationDate(doc)?.getUTCFullYear()).toBe(2023)
  })

  it('returns null when no date markers are present', () => {
    expect(extractPublicationDate(parseDoc('<p>no date here</p>'))).toBeNull()
  })

  it('returns null when the date string is invalid', () => {
    const doc = parseDoc('<meta name="date" content="not-a-real-date">')
    expect(extractPublicationDate(doc)).toBeNull()
  })
})

describe('isQualityContent', () => {
  const goodParagraph =
    'The quick brown fox and the lazy dog ran to the park in the morning. ' +
    'They played by the river and watched the boats go by for a while. ' +
    'Later the dog fell asleep under a tree near the water. ' +
    'The fox kept watch over the quiet field until the evening came.'

  it('accepts well-structured prose', () => {
    expect(isQualityContent(goodParagraph)).toBe(true)
  })

  it('rejects content shorter than 100 characters', () => {
    expect(isQualityContent('too short')).toBe(false)
    expect(isQualityContent('')).toBe(false)
  })

  it('rejects content with too few words', () => {
    // 150 chars but a single "word" (no whitespace)
    expect(isQualityContent('x'.repeat(150))).toBe(false)
  })

  it('rejects content with too few sentences', () => {
    // 60 words, no sentence punctuation -> a single sentence
    expect(isQualityContent('word '.repeat(60))).toBe(false)
  })
})
