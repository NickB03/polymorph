import {
  SearchImageItem,
  SearchResults,
  SerperSearchResultItem
} from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/error'
import { retrySearchOperation } from '@/lib/utils/retry'

import { SearchProvider, SearchTelemetryHook } from './base'
import { createHttpSearchError, SearchProviderError } from './errors'

interface BraveWebResult {
  title?: string
  description?: string
  url: string
}

interface BraveVideoResult {
  title?: string
  description?: string
  url?: string
  thumbnail?: {
    src?: string
  }
  video?: {
    duration?: string
  }
  duration?: string
  date?: string
  publisher?: string
}

interface BraveImageResult {
  title?: string
  source?: string
  url?: string
  thumbnail?: {
    src?: string
  }
  properties?: {
    thumbnail?: string
    width?: number
    height?: number
  }
  width?: number
  height?: number
}

export class BraveSearchProvider implements SearchProvider {
  private apiKey: string | undefined

  constructor() {
    this.apiKey = process.env.BRAVE_SEARCH_API_KEY
  }

  private getImageThumbnailUrl(result: BraveImageResult): string {
    return (
      result.thumbnail?.src ?? result.properties?.thumbnail ?? result.url ?? ''
    )
  }

  async search(
    query: string,
    maxResults: number = 10,
    searchDepth?: 'basic' | 'advanced',
    includeDomains?: string[],
    excludeDomains?: string[],
    options?: {
      type?: 'general' | 'optimized'
      content_types?: Array<'web' | 'video' | 'image' | 'news'>
    },
    telemetryHook?: SearchTelemetryHook
  ): Promise<SearchResults> {
    if (!this.apiKey) {
      throw new SearchProviderError({
        provider: 'brave',
        message: 'Brave Search API key not configured',
        retryable: false
      })
    }

    const contentTypes = options?.content_types || ['web']
    const results: SearchResults = {
      results: [],
      images: [],
      videos: [],
      query,
      number_of_results: 0
    }

    // Execute searches sequentially to avoid burst rate-limit hits
    if (contentTypes.includes('web')) {
      await this.searchWeb(query, maxResults, results, telemetryHook)
    }

    if (contentTypes.includes('video')) {
      await this.searchVideos(query, maxResults, results, telemetryHook)
    }

    if (contentTypes.includes('image')) {
      await this.searchImages(query, maxResults, results, telemetryHook)
    }

    // Update total count
    results.number_of_results = results.results.length

    return results
  }

  private async fetchBraveApi(
    endpoint: string,
    query: string,
    maxResults: number
  ): Promise<any> {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/${endpoint}/search?q=${encodeURIComponent(
        query
      )}&count=${maxResults}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey!
        }
      }
    )

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error(
        `Brave ${endpoint} search failed: ${response.status} ${response.statusText}`,
        body
      )
      throw createHttpSearchError(
        'brave',
        response.status,
        response.statusText,
        response.headers.get('retry-after'),
        body
      )
    }

    return response.json()
  }

  private async searchWeb(
    query: string,
    maxResults: number,
    results: SearchResults,
    telemetryHook?: SearchTelemetryHook
  ): Promise<void> {
    const data = await retrySearchOperation(
      () => this.fetchBraveApi('web', query, maxResults),
      (error, attempt, delayMs) => {
        console.log(
          `[Brave/web] Retry attempt ${attempt}:`,
          getErrorMessage(error)
        )
        telemetryHook?.(error, attempt, delayMs)
      }
    )
    results.results = (data.web?.results || [])
      .slice(0, maxResults)
      .map((result: BraveWebResult) => ({
        title: result.title || 'No title',
        description: result.description || 'No description available',
        url: result.url
      }))
  }

  private async searchVideos(
    query: string,
    maxResults: number,
    results: SearchResults,
    telemetryHook?: SearchTelemetryHook
  ): Promise<void> {
    try {
      const data = await retrySearchOperation(
        () => this.fetchBraveApi('videos', query, maxResults),
        (error, attempt, delayMs) => {
          console.log(
            `[Brave/videos] Retry attempt ${attempt}:`,
            getErrorMessage(error)
          )
          telemetryHook?.(error, attempt, delayMs)
        }
      )

      // Convert to SerperSearchResultItem format for compatibility
      results.videos = (data.results || []).slice(0, maxResults).map(
        (result: BraveVideoResult, index: number) =>
          ({
            title: result.title ?? 'No title',
            link: result.url ?? '',
            snippet: result.description ?? 'No description available',
            imageUrl: result.thumbnail?.src ?? '',
            duration: result.video?.duration ?? result.duration ?? '',
            source: result.publisher ?? '',
            channel: result.publisher ?? '',
            date: result.date ?? '',
            position: index
          }) as SerperSearchResultItem
      )
    } catch (error) {
      console.error('Brave video search error:', error)
      results.videos = []
    }
  }

  private async searchImages(
    query: string,
    maxResults: number,
    results: SearchResults,
    telemetryHook?: SearchTelemetryHook
  ): Promise<void> {
    try {
      const data = await retrySearchOperation(
        () => this.fetchBraveApi('images', query, maxResults),
        (error, attempt, delayMs) => {
          console.log(
            `[Brave/images] Retry attempt ${attempt}:`,
            getErrorMessage(error)
          )
          telemetryHook?.(error, attempt, delayMs)
        }
      )
      results.images = (data.results || []).slice(0, maxResults).map(
        (result: BraveImageResult) =>
          ({
            title: result.title || 'No title',
            link: result.url || result.source || '',
            thumbnailUrl: this.getImageThumbnailUrl(result)
          }) as SearchImageItem
      )
    } catch (error) {
      console.error('Brave image search error:', error)
      results.images = []
    }
  }
}
