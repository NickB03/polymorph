import { Redis } from '@upstash/redis'
import http from 'http'
import https from 'https'
import { JSDOM, VirtualConsole } from 'jsdom'
import { createClient } from 'redis'
import { z } from 'zod'

import {
  SearchResultItem,
  SearXNGResponse,
  SearXNGResult,
  SearXNGSearchResults
} from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/error'

const SEARXNG_MAX_RESULTS = Math.max(
  10,
  Math.min(100, parseInt(process.env.SEARXNG_MAX_RESULTS || '50', 10))
)

const CACHE_TTL = 3600

let redisClient: Redis | ReturnType<typeof createClient> | null = null

export const advancedSearchSchema = z.object({
  query: z.string().min(1, 'query is required').max(1000),
  maxResults: z.coerce.number().int().min(1).max(100).default(10),
  searchDepth: z.enum(['basic', 'advanced']).default('basic'),
  includeDomains: z.array(z.string()).default([]),
  excludeDomains: z.array(z.string()).default([])
})

export type AdvancedSearchInput = z.infer<typeof advancedSearchSchema>

async function initializeRedisClient() {
  if (redisClient) return redisClient

  const upstashRedisRestUrl = process.env.UPSTASH_REDIS_REST_URL
  const upstashRedisRestToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (upstashRedisRestUrl && upstashRedisRestToken) {
    redisClient = new Redis({
      url: upstashRedisRestUrl,
      token: upstashRedisRestToken
    })
    return redisClient
  }

  try {
    const localRedisUrl =
      process.env.LOCAL_REDIS_URL || 'redis://localhost:6379'
    const client = createClient({ url: localRedisUrl })
    await client.connect()
    redisClient = client
  } catch (error) {
    console.warn(
      'Failed to connect to local Redis. Advanced search caching disabled.',
      error
    )
    redisClient = null
  }

  return redisClient
}

async function getCachedResults(
  cacheKey: string
): Promise<SearXNGSearchResults | null> {
  try {
    const client = await initializeRedisClient()
    if (!client) return null

    const cachedData =
      client instanceof Redis
        ? await client.get<string>(cacheKey)
        : await client.get(cacheKey)

    if (cachedData) {
      return JSON.parse(cachedData)
    }
    return null
  } catch (error) {
    console.error('Redis cache error:', error)
    return null
  }
}

async function setCachedResults(
  cacheKey: string,
  results: SearXNGSearchResults
): Promise<void> {
  try {
    const client = await initializeRedisClient()
    if (!client) return

    const serializedResults = JSON.stringify(results)
    if (client instanceof Redis) {
      await client.set(cacheKey, serializedResults, { ex: CACHE_TTL })
    } else {
      await client.set(cacheKey, serializedResults, { EX: CACHE_TTL })
    }
  } catch (error) {
    console.error('Redis cache error:', error)
  }
}

export async function runAdvancedSearch({
  query,
  maxResults = 10,
  searchDepth = 'basic',
  includeDomains = [],
  excludeDomains = []
}: AdvancedSearchInput): Promise<SearXNGSearchResults> {
  const effectiveSearchDepth =
    searchDepth || (process.env.SEARXNG_DEFAULT_DEPTH as 'basic' | 'advanced')

  const cacheKey = `search:${query}:${maxResults}:${effectiveSearchDepth}:${includeDomains.join(',')}:${excludeDomains.join(',')}`
  const cachedResults = await getCachedResults(cacheKey)

  if (cachedResults) {
    return cachedResults
  }

  const results = await advancedSearchXNGSearch(
    query,
    Math.min(maxResults, SEARXNG_MAX_RESULTS),
    effectiveSearchDepth,
    includeDomains,
    excludeDomains
  )

  await setCachedResults(cacheKey, results)

  return results
}

async function advancedSearchXNGSearch(
  query: string,
  maxResults: number,
  searchDepth: 'basic' | 'advanced',
  includeDomains: string[],
  excludeDomains: string[]
): Promise<SearXNGSearchResults> {
  const apiUrl = process.env.SEARXNG_API_URL
  if (!apiUrl) {
    throw new Error('SEARXNG_API_URL is not set in the environment variables')
  }

  const searxngEngines =
    process.env.SEARXNG_ENGINES || 'google,bing,duckduckgo,wikipedia'
  const searxngTimeRange = process.env.SEARXNG_TIME_RANGE || 'None'
  const searxngSafesearch = process.env.SEARXNG_SAFESEARCH || '0'
  const searxngCrawlMultiplier = parseInt(
    process.env.SEARXNG_CRAWL_MULTIPLIER || '4',
    10
  )

  try {
    const url = new URL(`${apiUrl}/search`)
    url.searchParams.append('q', query)
    url.searchParams.append('format', 'json')
    url.searchParams.append('categories', 'general,images')

    if (searxngTimeRange !== 'None') {
      url.searchParams.append('time_range', searxngTimeRange)
    }

    url.searchParams.append('safesearch', searxngSafesearch)
    url.searchParams.append('engines', searxngEngines)
    url.searchParams.append('pageno', String(Math.ceil(maxResults / 10)))

    const data:
      | SearXNGResponse
      | { error: string; status: number; data: string } =
      await fetchJsonWithRetry(url.toString(), 3)

    if ('error' in data) {
      throw new Error(
        `Invalid response from SearXNG: ${data.error}. Status: ${data.status}. Data: ${data.data}`
      )
    }

    if (!Array.isArray(data.results)) {
      throw new Error('Invalid response structure from SearXNG')
    }

    let generalResults = data.results.filter(
      (result: SearXNGResult) => result && !result.img_src
    )

    if (includeDomains.length > 0 || excludeDomains.length > 0) {
      generalResults = generalResults.filter(result => {
        const domain = new URL(result.url).hostname
        return (
          (includeDomains.length === 0 ||
            includeDomains.some(d => domain.includes(d))) &&
          (excludeDomains.length === 0 ||
            !excludeDomains.some(d => domain.includes(d)))
        )
      })
    }

    if (searchDepth === 'advanced') {
      const crawledResults = await Promise.all(
        generalResults
          .slice(0, maxResults * searxngCrawlMultiplier)
          .map(result => crawlPage(result, query))
      )

      generalResults = crawledResults
        .filter(result => result !== null && isQualityContent(result.content))
        .map(result => result as SearXNGResult)
        .map(result => ({
          ...result,
          score: calculateRelevanceScore(result, query)
        }))
        .filter(result => (result.score ?? 0) >= 10)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, maxResults)
    }

    const imageResults = data.results
      .filter((result: SearXNGResult) => result && result.img_src)
      .slice(0, maxResults)

    return {
      results: generalResults.slice(0, maxResults).map(
        (result: SearXNGResult): SearchResultItem => ({
          title: result.title || '',
          url: result.url || '',
          content: result.content || ''
        })
      ),
      query: data.query || query,
      images: imageResults
        .map(result => {
          const imgSrc = result.img_src || ''
          return imgSrc.startsWith('http') ? imgSrc : `${apiUrl}${imgSrc}`
        })
        .filter(Boolean),
      number_of_results: data.number_of_results ?? generalResults.length
    }
  } catch (error) {
    console.error('SearchXNG API error:', error)
    return {
      results: [],
      query,
      images: [],
      number_of_results: 0
    }
  }
}

async function crawlPage(
  result: SearXNGResult,
  query: string
): Promise<SearXNGResult> {
  try {
    const html = await fetchHtmlWithTimeout(result.url, 20000)
    const virtualConsole = new VirtualConsole()
    virtualConsole.on('error', () => {})
    virtualConsole.on('warn', () => {})

    const dom = new JSDOM(html, {
      runScripts: 'outside-only',
      resources: 'usable',
      virtualConsole
    })
    const document = dom.window.document

    document
      .querySelectorAll('script, style, nav, header, footer')
      .forEach((el: Element) => el.remove())

    const mainContent =
      document.querySelector('main') ||
      document.querySelector('article') ||
      document.querySelector('.content') ||
      document.querySelector('#content') ||
      document.body

    if (mainContent) {
      const priorityElements = mainContent.querySelectorAll('h1, h2, h3, p')
      let extractedText = Array.from(priorityElements)
        .map(el => el.textContent?.trim())
        .filter(Boolean)
        .join('\n\n')

      if (extractedText.length < 500) {
        extractedText +=
          '\n\n' +
          Array.from(
            mainContent.querySelectorAll(
              'h4, h5, h6, li, td, th, blockquote, pre, code'
            )
          )
            .map(el => el.textContent?.trim())
            .filter(Boolean)
            .join('\n\n')
      }

      const metaDescription =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute('content') || ''
      const metaKeywords =
        document
          .querySelector('meta[name="keywords"]')
          ?.getAttribute('content') || ''
      const ogTitle =
        document
          .querySelector('meta[property="og:title"]')
          ?.getAttribute('content') || ''
      const ogDescription =
        document
          .querySelector('meta[property="og:description"]')
          ?.getAttribute('content') || ''

      extractedText =
        `${result.title}\n\n${ogTitle}\n\n${metaDescription}\n\n${ogDescription}\n\n${metaKeywords}\n\n${extractedText}`.substring(
          0,
          10000
        )

      result.content = highlightQueryTerms(extractedText, query)

      const publishedDate = extractPublicationDate(document)
      if (publishedDate) {
        result.publishedDate = publishedDate.toISOString()
      }
    }

    return result
  } catch (error) {
    console.error(`Error crawling ${result.url}:`, error)
    return {
      ...result,
      content: result.content || 'Content unavailable due to crawling error.'
    }
  }
}

function highlightQueryTerms(content: string, query: string): string {
  try {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    let highlightedContent = content

    terms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi')
      highlightedContent = highlightedContent.replace(
        regex,
        match => `<mark>${match}</mark>`
      )
    })

    return highlightedContent
  } catch {
    return content
  }
}

function calculateRelevanceScore(result: SearXNGResult, query: string): number {
  try {
    const lowercaseContent = result.content.toLowerCase()
    const lowercaseQuery = query.toLowerCase()
    const queryWords = lowercaseQuery
      .split(/\s+/)
      .filter(word => word.length > 2)
      .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    let score = 0

    if (lowercaseContent.includes(lowercaseQuery)) score += 30

    queryWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g')
      score += (lowercaseContent.match(regex) || []).length * 3
    })

    const lowercaseTitle = result.title.toLowerCase()
    if (lowercaseTitle.includes(lowercaseQuery)) score += 20

    queryWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g')
      if (lowercaseTitle.match(regex)) score += 10
    })

    if (result.publishedDate) {
      const daysSincePublished =
        (Date.now() - new Date(result.publishedDate).getTime()) /
        (1000 * 3600 * 24)
      if (daysSincePublished < 30) score += 15
      else if (daysSincePublished < 90) score += 10
      else if (daysSincePublished < 365) score += 5
    }

    if (result.content.length < 200) score -= 10
    else if (result.content.length > 1000) score += 5

    score += (result.content.match(/<mark>/g) || []).length * 2

    return score
  } catch {
    return 0
  }
}

function extractPublicationDate(document: Document): Date | null {
  const dateSelectors = [
    'meta[name="article:published_time"]',
    'meta[property="article:published_time"]',
    'meta[name="publication-date"]',
    'meta[name="date"]',
    'time[datetime]',
    'time[pubdate]'
  ]

  for (const selector of dateSelectors) {
    const element = document.querySelector(selector)
    if (element) {
      const dateStr =
        element.getAttribute('content') ||
        element.getAttribute('datetime') ||
        element.getAttribute('pubdate')
      if (dateStr) {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          return date
        }
      }
    }
  }

  return null
}

const httpAgent = new http.Agent({ keepAlive: true })
const httpsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: true
})

async function fetchJsonWithRetry(url: string, retries: number): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchJson(url)
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http
    const agent = url.startsWith('https:') ? httpsAgent : httpAgent
    const request = protocol.get(url, { agent }, res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', () => {
        try {
          if (res.headers['content-type']?.includes('application/json')) {
            resolve(JSON.parse(data))
          } else {
            resolve({
              error: 'Invalid JSON response',
              status: res.statusCode,
              data: data.substring(0, 200)
            })
          }
        } catch (error) {
          reject(error)
        }
      })
    })
    request.on('error', reject)
    request.on('timeout', () => {
      request.destroy()
      reject(new Error('Request timed out'))
    })
    request.setTimeout(15000)
  })
}

async function fetchHtmlWithTimeout(
  url: string,
  timeoutMs: number
): Promise<string> {
  try {
    return await Promise.race([
      fetchHtml(url),
      timeout(timeoutMs, `Fetching ${url} timed out after ${timeoutMs}ms`)
    ])
  } catch (error) {
    console.error(`Error fetching ${url}:`, error)
    const errorMessage = getErrorMessage(error)
    return `<html><body>Error fetching content: ${errorMessage}</body></html>`
  }
}

function fetchHtml(url: string, remainingRedirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http
    const agent = url.startsWith('https:') ? httpsAgent : httpAgent
    const request = protocol.get(url, { agent }, res => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        if (remainingRedirects <= 0) {
          reject(new Error('Too many redirects'))
          return
        }

        fetchHtml(
          new URL(res.headers.location, url).toString(),
          remainingRedirects - 1
        )
          .then(resolve)
          .catch(reject)
        return
      }

      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', () => resolve(data))
    })
    request.on('error', reject)
    request.on('timeout', () => {
      request.destroy()
      resolve('')
    })
    request.setTimeout(10000)
  })
}

function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message))
    }, ms)
  })
}

function isQualityContent(text: string): boolean {
  const words = text.split(/\s+/).length
  const sentences = text.split(/[.!?]+/).length
  const avgWordsPerSentence = words / sentences

  return (
    words > 50 &&
    sentences > 3 &&
    avgWordsPerSentence > 5 &&
    avgWordsPerSentence < 30 &&
    !text.includes('Content unavailable due to crawling error') &&
    !text.includes('Error fetching content:')
  )
}
