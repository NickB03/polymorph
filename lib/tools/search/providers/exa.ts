import Exa from 'exa-js'

import { SearchResults } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/error'
import { retrySearchOperation } from '@/lib/utils/retry'

import { BaseSearchProvider, SearchTelemetryHook } from './base'
import { extractHttpErrorInfo } from './error-utils'
import { createHttpSearchError, SearchProviderError } from './errors'

export class ExaSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    _searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = [],
    _options?: {
      type?: 'general' | 'optimized'
      content_types?: Array<'web' | 'video' | 'image' | 'news'>
      includeImages?: boolean
    },
    telemetryHook?: SearchTelemetryHook
  ): Promise<SearchResults> {
    const apiKey = process.env.EXA_API_KEY
    this.validateApiKey(apiKey, 'EXA')

    const exa = new Exa(apiKey)
    const exaResults = await retrySearchOperation(
      async () => {
        try {
          return await exa.searchAndContents(query, {
            highlights: true,
            numResults: maxResults,
            includeDomains,
            excludeDomains
          })
        } catch (error) {
          if (error instanceof SearchProviderError) {
            throw error
          }
          const { status, statusText, retryAfter } = extractHttpErrorInfo(error)
          if (typeof status === 'number') {
            throw createHttpSearchError(
              'exa',
              status,
              statusText ?? String(error),
              retryAfter,
              error
            )
          }
          throw new SearchProviderError({
            provider: 'exa',
            message:
              error instanceof Error ? error.message : 'Exa search failed',
            retryable: true,
            cause: error
          })
        }
      },
      (error, attempt, delayMs) => {
        console.log(`[Exa] Retry attempt ${attempt}:`, getErrorMessage(error))
        telemetryHook?.(error, attempt, delayMs)
      }
    )

    return {
      results: exaResults.results.map(result => ({
        title: result.title ?? '',
        url: result.url,
        content: result.highlights?.join(' ') ?? ''
      })),
      query,
      images: [],
      number_of_results: exaResults.results.length
    }
  }
}
