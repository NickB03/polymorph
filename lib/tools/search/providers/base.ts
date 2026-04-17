import { SearchResults } from '@/lib/types'

import { SearchProviderError, SearchProviderName } from './errors'

export interface SearchProvider {
  search(
    query: string,
    maxResults: number,
    searchDepth: 'basic' | 'advanced',
    includeDomains: string[],
    excludeDomains: string[],
    options?: {
      type?: 'general' | 'optimized'
      content_types?: Array<'web' | 'video' | 'image' | 'news'>
      includeImages?: boolean
    }
  ): Promise<SearchResults>
}

export abstract class BaseSearchProvider implements SearchProvider {
  abstract search(
    query: string,
    maxResults: number,
    searchDepth: 'basic' | 'advanced',
    includeDomains: string[],
    excludeDomains: string[],
    options?: {
      type?: 'general' | 'optimized'
      content_types?: Array<'web' | 'video' | 'image' | 'news'>
      includeImages?: boolean
    }
  ): Promise<SearchResults>

  protected validateApiKey(
    key: string | undefined,
    providerName: string
  ): asserts key is string {
    if (!key) {
      throw new SearchProviderError({
        provider: providerName.toLowerCase() as SearchProviderName,
        message: `${providerName}_API_KEY is not set in the environment variables`,
        retryable: false
      })
    }
  }

  protected validateApiUrl(
    url: string | undefined,
    providerName: string
  ): void {
    if (!url) {
      throw new SearchProviderError({
        provider: providerName.toLowerCase() as SearchProviderName,
        message: `${providerName}_API_URL is not set in the environment variables`,
        retryable: false
      })
    }
  }
}
