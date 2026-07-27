import { describe, expect, it } from 'vitest'

import { formatEvalContext, MAX_SNIPPET_CHARS } from './eval-output'

describe('formatEvalContext', () => {
  it('caps each snippet at MAX_SNIPPET_CHARS in formatEvalContext', () => {
    const long = 'x'.repeat(5000)
    const out = formatEvalContext({
      searchResults: [
        {
          query: 'q',
          results: [{ title: 't', url: 'https://u', snippet: long }]
        }
      ],
      citations: []
    })
    expect(out.length).toBeLessThan(2200)
    expect(out).toContain('…')
  })

  it('leaves snippets at or below MAX_SNIPPET_CHARS untouched', () => {
    const snippet = 'y'.repeat(MAX_SNIPPET_CHARS)
    const out = formatEvalContext({
      searchResults: [
        { query: 'q', results: [{ title: 't', url: 'https://u', snippet }] }
      ],
      citations: []
    })
    expect(out).toContain(snippet)
    expect(out).not.toContain('…')
  })
})
