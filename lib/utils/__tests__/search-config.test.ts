import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getContentTypesGuidance,
  getGeneralSearchProviderName,
  getGeneralSearchProviderType,
  getSearchStrategyGuidance,
  getSearchToolDescription,
  getSearchTypeDescription,
  isGeneralSearchProviderAvailable,
  supportsMultimediaContentTypes
} from '../search-config'

describe('search-config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.stubGlobal('process', {
      ...process,
      env: { ...originalEnv }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('isGeneralSearchProviderAvailable', () => {
    it('returns true when BRAVE_SEARCH_API_KEY is set', () => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-key'
      expect(isGeneralSearchProviderAvailable()).toBe(true)
    })

    it('returns false when BRAVE_SEARCH_API_KEY is not set', () => {
      delete process.env.BRAVE_SEARCH_API_KEY
      expect(isGeneralSearchProviderAvailable()).toBe(false)
    })
  })

  describe('getGeneralSearchProviderName', () => {
    it('returns "Brave Search" when Brave key is set', () => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-key'
      expect(getGeneralSearchProviderName()).toBe('Brave Search')
    })

    it('returns "primary provider" when no Brave key', () => {
      delete process.env.BRAVE_SEARCH_API_KEY
      expect(getGeneralSearchProviderName()).toBe('primary provider')
    })
  })

  describe('supportsMultimediaContentTypes', () => {
    it('returns true when Brave key is set', () => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-key'
      expect(supportsMultimediaContentTypes()).toBe(true)
    })

    it('returns false when no Brave key', () => {
      delete process.env.BRAVE_SEARCH_API_KEY
      expect(supportsMultimediaContentTypes()).toBe(false)
    })
  })

  describe('getSearchTypeDescription', () => {
    it('includes general provider info when Brave is available', () => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-key'
      const desc = getSearchTypeDescription()
      expect(desc).toContain('Brave Search')
      expect(desc).toContain('general')
    })

    it('indicates no general provider when Brave is not available', () => {
      delete process.env.BRAVE_SEARCH_API_KEY
      const desc = getSearchTypeDescription()
      expect(desc).toContain('not configured')
    })
  })

  describe('getSearchToolDescription', () => {
    it('mentions multimedia when Brave is available', () => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-key'
      const desc = getSearchToolDescription()
      expect(desc).toContain('video')
    })

    it('notes limitation when no multimedia provider', () => {
      delete process.env.BRAVE_SEARCH_API_KEY
      const desc = getSearchToolDescription()
      expect(desc).toContain('not configured')
    })
  })

  describe('getContentTypesGuidance', () => {
    it('includes multimedia guidance when Brave is available', () => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-key'
      const guidance = getContentTypesGuidance()
      expect(guidance).toContain('Brave Search')
      expect(guidance).toContain('video')
      expect(guidance).toContain('image')
      expect(guidance).toContain('fetch only when the result is a PDF')
    })

    it('notes no multimedia support when unavailable', () => {
      delete process.env.BRAVE_SEARCH_API_KEY
      const guidance = getContentTypesGuidance()
      expect(guidance).toContain('not supported')
    })
  })

  describe('getSearchStrategyGuidance', () => {
    it('keeps search as the primary evidence path', () => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-key'
      const guidance = getSearchStrategyGuidance()

      expect(guidance).toContain('primary evidence path')
      expect(guidance).toContain('Fetch only when the user provided a URL')
      expect(guidance).toContain('Prefer regular fetch for normal web pages')
    })
  })

  describe('getGeneralSearchProviderType', () => {
    it('returns "brave" when Brave key is set', () => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-key'
      expect(getGeneralSearchProviderType()).toBe('brave')
    })

    it('returns null when no Brave key', () => {
      delete process.env.BRAVE_SEARCH_API_KEY
      expect(getGeneralSearchProviderType()).toBeNull()
    })
  })
})
