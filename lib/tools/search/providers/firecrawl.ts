import {
  FirecrawlClient,
  FirecrawlImageResult,
  FirecrawlNewsResult,
  FirecrawlWebResult
} from '@/lib/firecrawl'
import {
  BaseSearchProvider,
  SearchTelemetryHook
} from '@/lib/tools/search/providers/base'
import { extractHttpErrorInfo } from '@/lib/tools/search/providers/error-utils'
import {
  createHttpSearchError,
  SearchProviderError
} from '@/lib/tools/search/providers/errors'
import { SearchResults } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/error'
import { retrySearchOperation } from '@/lib/utils/retry'

export class FirecrawlSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = [],
    _options?: {
      type?: 'general' | 'optimized'
      content_types?: Array<'web' | 'video' | 'image' | 'news'>
      includeImages?: boolean
    },
    telemetryHook?: SearchTelemetryHook
  ): Promise<SearchResults> {
    const apiKey = process.env.FIRECRAWL_API_KEY
    this.validateApiKey(apiKey, 'FIRECRAWL')

    const firecrawl = new FirecrawlClient(apiKey)

    const sources: ('web' | 'news' | 'images')[] = ['web']
    if (searchDepth === 'advanced') {
      sources.push('news')
    }
    sources.push('images')

    const response = await retrySearchOperation(
      async () => {
        try {
          return await firecrawl.search({
            query,
            sources,
            limit: maxResults
            // Note: Firecrawl Search API does not support includeDomains/excludeDomains yet...
          })
        } catch (error) {
          if (error instanceof SearchProviderError) {
            throw error
          }
          const { status, statusText, retryAfter } = extractHttpErrorInfo(error)
          if (typeof status === 'number') {
            throw createHttpSearchError(
              'firecrawl',
              status,
              statusText ?? String(error),
              retryAfter,
              error
            )
          }
          throw new SearchProviderError({
            provider: 'firecrawl',
            message:
              error instanceof Error
                ? error.message
                : 'Firecrawl search failed',
            retryable: true,
            cause: error
          })
        }
      },
      (error, attempt, delayMs) => {
        console.log(
          `[Firecrawl] Retry attempt ${attempt}:`,
          getErrorMessage(error)
        )
        telemetryHook?.(error, attempt, delayMs)
      }
    )

    const resources: (FirecrawlWebResult | FirecrawlNewsResult)[] = [
      ...(response.data?.web || []),
      ...(response.data?.news || [])
    ]

    const results = resources.map(resource => {
      if ('markdown' in resource) {
        // The `markdown` key can be present but null/undefined on a scrape
        // miss, so guard the value, not just key presence.
        const markdown = (resource.markdown ?? '').slice(0, 1000)
        return {
          title: resource.title || '',
          url: resource.url,
          content: markdown || resource.description || ''
        }
      }

      return {
        title: resource.title || '',
        url: resource.url,
        content: resource.snippet || ''
      }
    })

    const images =
      response.data?.images?.map((img: FirecrawlImageResult) => ({
        url: img.imageUrl,
        description: img.title || ''
      })) || []

    return {
      results,
      query,
      images,
      number_of_results: results.length
    }
  }
}
