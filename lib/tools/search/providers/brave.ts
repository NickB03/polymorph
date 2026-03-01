import {
  SearchImageItem,
  SearchResults,
  SerperSearchResultItem
} from '@/lib/types'

import { SearchProvider } from './base'

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
    }
  ): Promise<SearchResults> {
    if (!this.apiKey) {
      throw new Error('Brave Search API key not configured')
    }

    const contentTypes = options?.content_types || ['web']
    const results: SearchResults = {
      results: [],
      images: [],
      videos: [],
      query,
      number_of_results: 0
    }

    // Execute searches in parallel for each content type
    const promises: Promise<void>[] = []

    if (contentTypes.includes('web')) {
      promises.push(this.searchWeb(query, maxResults, results))
    }

    if (contentTypes.includes('video')) {
      promises.push(this.searchVideos(query, maxResults, results))
    }

    if (contentTypes.includes('image')) {
      promises.push(this.searchImages(query, maxResults, results))
    }

    await Promise.all(promises)

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
      console.error(`Brave ${endpoint} search failed: ${response.statusText}`)
      throw new Error('Search failed')
    }

    return response.json()
  }

  private async searchWeb(
    query: string,
    maxResults: number,
    results: SearchResults
  ): Promise<void> {
    try {
      const data = await this.fetchBraveApi('web', query, maxResults)
      results.results = (data.web?.results || [])
        .slice(0, maxResults)
        .map((result: BraveWebResult) => ({
          title: result.title || 'No title',
          description: result.description || 'No description available',
          url: result.url
        }))
    } catch (error) {
      console.error('Brave web search error:', error)
    }
  }

  private async searchVideos(
    query: string,
    maxResults: number,
    results: SearchResults
  ): Promise<void> {
    try {
      const data = await this.fetchBraveApi('videos', query, maxResults)

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
    results: SearchResults
  ): Promise<void> {
    try {
      const data = await this.fetchBraveApi('images', query, maxResults)
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
