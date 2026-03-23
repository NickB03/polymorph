import { tool, UIToolInvocation } from 'ai'

import { fetchSchema } from '@/lib/schema/fetch'
import { SearchResults as SearchResultsType } from '@/lib/types'

const CONTENT_CHARACTER_LIMIT = 50000
const TITLE_CHARACTER_LIMIT = 100

function isPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf')
  } catch {
    return url.toLowerCase().includes('.pdf')
  }
}

function extractProviderMessage(body: string): string {
  const trimmedBody = body.trim()
  if (!trimmedBody) {
    return 'Unknown provider error'
  }

  try {
    const parsedBody = JSON.parse(trimmedBody)
    const nestedMessage = findNestedProviderMessage(parsedBody)
    if (nestedMessage) {
      return nestedMessage
    }
  } catch {
    // Ignore JSON parsing failures and fall back to the raw body text.
  }

  return trimmedBody
}

function findNestedProviderMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    return trimmedValue.length > 0 ? trimmedValue : null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedMessage = findNestedProviderMessage(item)
      if (nestedMessage) {
        return nestedMessage
      }
    }
    return null
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  for (const key of ['error', 'message', 'detail', 'title']) {
    const nestedMessage = findNestedProviderMessage(record[key])
    if (nestedMessage) {
      return nestedMessage
    }
  }

  for (const nestedValue of Object.values(record)) {
    const nestedMessage = findNestedProviderMessage(nestedValue)
    if (nestedMessage) {
      return nestedMessage
    }
  }

  return null
}

function isRecoverableHtmlExtractFailure(url: string, error: unknown): boolean {
  if (isPdfUrl(url) || !(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('tavily extract') ||
    message.includes('jina reader') ||
    message.includes('content extraction service') ||
    message.includes('no data returned from jina reader api')
  )
}

async function fetchRegularData(
  url: string,
  abortSignal?: AbortSignal
): Promise<SearchResultsType> {
  try {
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), 10000) // 10 second timeout
    const signal = abortSignal
      ? AbortSignal.any([timeoutController.signal, abortSignal])
      : timeoutController.signal

    const response = await fetch(url, {
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Polymorph/1.0)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('text/plain')
    ) {
      throw new Error(`Unsupported content type: ${contentType}`)
    }

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const rawTitle = titleMatch ? titleMatch[1].trim() : new URL(url).hostname
    const title =
      rawTitle.length > TITLE_CHARACTER_LIMIT
        ? rawTitle.substring(0, TITLE_CHARACTER_LIMIT) + '...'
        : rawTitle

    // Process HTML content
    let processedHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles

    // Replace img tags with alt text or [IMAGE] markers
    processedHtml = processedHtml
      .replace(/<img[^>]+alt\s*=\s*["']([^"']+)["'][^>]*>/gi, ' [IMAGE: $1] ')
      .replace(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi, ' [IMAGE] ')
      .replace(/<img[^>]*>/gi, ' [IMAGE] ')

    // Extract text content
    const textContent = processedHtml
      .replace(/<[^>]*>/g, ' ') // Remove remaining HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()

    // Limit content length
    const truncatedContent =
      textContent.length > CONTENT_CHARACTER_LIMIT
        ? textContent.substring(0, CONTENT_CHARACTER_LIMIT) + '...[truncated]'
        : textContent

    return {
      results: [
        {
          title,
          content: truncatedContent,
          url
        }
      ],
      query: '',
      images: []
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout after 10 seconds')
    }
    console.error('Fetch error:', error)
    throw error instanceof Error ? error : new Error('Unknown fetch error')
  }
}

async function fetchJinaReaderData(
  url: string,
  abortSignal?: AbortSignal
): Promise<SearchResultsType> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-With-Generated-Alt': 'true'
      },
      signal: abortSignal
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `Jina Reader error ${response.status}: ${extractProviderMessage(body)}`
      )
    }

    const json = await response.json()
    if (!json.data || !json.data.content) {
      throw new Error('No data returned from Jina Reader API')
    }

    const content = json.data.content.slice(0, CONTENT_CHARACTER_LIMIT)

    return {
      results: [
        {
          title: json.data.title,
          content,
          url: json.data.url
        }
      ],
      query: '',
      images: []
    }
  } catch (error) {
    console.error('API Error:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Jina Reader API failed')
  }
}

async function fetchTavilyExtractData(
  url: string,
  abortSignal?: AbortSignal
): Promise<SearchResultsType> {
  try {
    const apiKey = process.env.TAVILY_API_KEY
    const response = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ api_key: apiKey, urls: [url] }),
      signal: abortSignal
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `Tavily extract error ${response.status}: ${extractProviderMessage(body)}`
      )
    }

    const json = await response.json()
    if (!json.results || json.results.length === 0) {
      throw new Error('No results returned from content extraction service')
    }

    const result = json.results[0]
    const content = (result.raw_content || '').slice(0, CONTENT_CHARACTER_LIMIT)

    return {
      results: [
        {
          title: content.slice(0, TITLE_CHARACTER_LIMIT),
          content,
          url: result.url
        }
      ],
      query: '',
      images: []
    }
  } catch (error) {
    console.error('API Error:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Content extraction service failed')
  }
}

export const fetchTool = tool({
  description:
    'Fetch content from any URL. By default uses "regular" type which performs fast, direct HTML fetching without external APIs - ideal for most websites. IMPORTANT: "regular" type does NOT support PDFs and will fail on PDF URLs. Use "api" type when you need: 1) PDF content extraction (required for .pdf URLs), 2) Complex JavaScript-rendered pages, 3) Better markdown formatting, 4) Table extraction. The "api" type requires Jina or Tavily API keys and uses Jina Reader if available, otherwise falls back to Tavily Extract.',
  inputSchema: fetchSchema,
  async *execute({ url, type = 'regular' }, context) {
    // Yield initial fetching state
    yield {
      state: 'fetching' as const,
      url
    }

    if (context?.abortSignal?.aborted) return

    let results: SearchResultsType

    if (type === 'regular') {
      // Use regular fetch for direct HTML retrieval
      results = await fetchRegularData(url, context?.abortSignal)
    } else {
      // Use API-based extraction (Jina or Tavily)
      const useJina = process.env.JINA_API_KEY
      try {
        if (useJina) {
          results = await fetchJinaReaderData(url, context?.abortSignal)
        } else {
          results = await fetchTavilyExtractData(url, context?.abortSignal)
        }
      } catch (error) {
        if (isRecoverableHtmlExtractFailure(url, error)) {
          results = await fetchRegularData(url, context?.abortSignal)
        } else {
          throw error
        }
      }
    }

    // Yield final results with complete state
    yield {
      state: 'complete' as const,
      ...results
    }
  }
})

// Export type for UI tool invocation
export type FetchUIToolInvocation = UIToolInvocation<typeof fetchTool>
