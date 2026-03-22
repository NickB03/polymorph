import { describe, expect, it } from 'vitest'

import { buildLegacyCanvasNotice, resolveLegacyCanvasReference } from './legacy'

describe('resolveLegacyCanvasReference', () => {
  it('resolves reopened legacy references before any canvas open attempt', () => {
    const notice = resolveLegacyCanvasReference({
      artifactId: 'legacy-artifact-1',
      source: 'chat-history'
    })
    expect(notice.kind).toBe('legacy-unavailable')
    expect(notice.artifactId).toBe('legacy-artifact-1')
    expect(notice.source).toBe('chat-history')
  })

  it('resolves public-link legacy references', () => {
    const notice = resolveLegacyCanvasReference({
      artifactId: 'legacy-artifact-2',
      source: 'public-link'
    })
    expect(notice.kind).toBe('legacy-unavailable')
    expect(notice.source).toBe('public-link')
  })

  it('resolves guest-token legacy references', () => {
    const notice = resolveLegacyCanvasReference({
      artifactId: 'legacy-artifact-3',
      source: 'guest-token'
    })
    expect(notice.kind).toBe('legacy-unavailable')
    expect(notice.source).toBe('guest-token')
  })
})

describe('buildLegacyCanvasNotice', () => {
  it('returns a legacy-unavailable notice', () => {
    const notice = buildLegacyCanvasNotice({
      artifactId: 'test-artifact',
      source: 'chat-history'
    })
    expect(notice.kind).toBe('legacy-unavailable')
    expect(notice.artifactId).toBe('test-artifact')
    expect(notice.source).toBe('chat-history')
  })
})
