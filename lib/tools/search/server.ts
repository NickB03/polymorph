import { trace } from '@opentelemetry/api'
import { tool, UIToolInvocation } from 'ai'

import { SearchResultItem, SearchResults } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/error'
import {
  getGeneralSearchProviderType,
  getSearchToolDescription
} from '@/lib/utils/search-config'

import { isRetryableSearchError, SearchProviderError } from './providers/errors'
import { runAdvancedSearch } from './advanced-search'
import {
  createSearchProvider,
  DEFAULT_PROVIDER,
  SearchProviderType
} from './providers'
import { getSearchSchemaForModel } from './schema'

const MAX_SPAN_EVENT_MESSAGE_LENGTH = 256

function truncateErrorMessage(error: unknown): string {
  const message = getErrorMessage(error)
  if (message.length <= MAX_SPAN_EVENT_MESSAGE_LENGTH) return message
  return message.slice(0, MAX_SPAN_EVENT_MESSAGE_LENGTH)
}

const PROVIDER_ENV_KEYS: Partial<Record<SearchProviderType, string>> = {
  brave: 'BRAVE_SEARCH_API_KEY',
  tavily: 'TAVILY_API_KEY',
  exa: 'EXA_API_KEY',
  firecrawl: 'FIRECRAWL_API_KEY'
}

function isProviderConfigured(provider: SearchProviderType): boolean {
  const envKey = PROVIDER_ENV_KEYS[provider]

  return envKey ? Boolean(process.env[envKey]) : true
}

function getSearchProviderSequence(
  primaryProvider: SearchProviderType
): SearchProviderType[] {
  const fallbackProviders: SearchProviderType[] =
    primaryProvider === 'brave'
      ? ['tavily', 'exa']
      : primaryProvider === 'tavily'
        ? ['exa']
        : ['tavily', 'exa']

  const orderedProviders = [primaryProvider, ...fallbackProviders]
  const uniqueProviders = orderedProviders.filter(
    (provider, index) => orderedProviders.indexOf(provider) === index
  )

  return uniqueProviders.filter(provider => {
    if (isProviderConfigured(provider)) {
      return true
    }

    if (provider === primaryProvider) {
      console.warn(
        `[Search] Provider ${provider} is selected but not configured. Skipping to the next available provider.`
      )
    }

    return false
  })
}

function formatSearchFailureMessage(message: string): string {
  return `${message}. IMPORTANT: Do NOT use [number](#toolCallId) citations for this failed search — no results are available to cite.`
}

/**
 * Creates a search tool with the appropriate schema for the given model.
 */
export function createSearchTool(fullModel: string) {
  return tool({
    description: getSearchToolDescription(),
    inputSchema: getSearchSchemaForModel(fullModel),
    async *execute(
      {
        query,
        type = 'optimized',
        content_types = ['web'],
        max_results = 20,
        search_depth = 'basic', // Default for standard schema
        include_domains = [],
        exclude_domains = []
      },
      context
    ) {
      // Yield initial searching state
      yield {
        state: 'searching' as const,
        query
      }

      if (context?.abortSignal?.aborted) return

      // Ensure max_results is at least 10
      const minResults = 10
      const effectiveMaxResults = Math.max(
        max_results || minResults,
        minResults
      )
      const effectiveSearchDepth = search_depth as 'basic' | 'advanced'

      // Use the original query as is - any provider-specific handling will be done in the provider
      const filledQuery = query
      let searchResult: SearchResults | null = null

      // Determine which provider to use based on type
      let searchAPI: SearchProviderType
      if (type === 'general') {
        // Try to use dedicated general search provider
        const generalProvider = getGeneralSearchProviderType()
        if (generalProvider) {
          searchAPI = generalProvider
        } else {
          // Fallback to primary provider (optimized search provider)
          searchAPI =
            (process.env.SEARCH_API as SearchProviderType) || DEFAULT_PROVIDER
          console.log(
            `[Search] type="general" requested but no dedicated provider available, using optimized search provider: ${searchAPI}`
          )
        }
      } else {
        // For 'optimized', use the configured provider
        searchAPI =
          (process.env.SEARCH_API as SearchProviderType) || DEFAULT_PROVIDER
      }

      const effectiveSearchDepthForAPI =
        searchAPI === 'searxng' &&
        process.env.SEARXNG_DEFAULT_DEPTH === 'advanced'
          ? 'advanced'
          : effectiveSearchDepth || 'basic'

      const searchProviders = getSearchProviderSequence(searchAPI)

      console.log(
        `Using search API chain: ${searchProviders.join(' -> ') || searchAPI}, Type: ${type}, Search Depth: ${effectiveSearchDepthForAPI}`
      )

      if (context?.abortSignal?.aborted) return

      // Turn-scoped telemetry counters (aggregated onto the active span
      // after the provider loop completes). All `trace.getActiveSpan()`
      // calls are optional-chained — when tracing is disabled, these
      // calls are all no-ops.
      const providersAttempted: SearchProviderType[] = []
      let totalRetries = 0
      let totalFallbacks = 0

      // Retry-attempt telemetry hook shared across providers. Captures
      // `provider` via closure; per-retry `attempt`/`delayMs` come from
      // the retry runtime.
      const makeTelemetryHook = (provider: SearchProviderType) => {
        return (error: unknown, attempt: number, delayMs: number) => {
          totalRetries += 1
          const status =
            error instanceof SearchProviderError ? error.status : undefined
          const retryAfterMs =
            error instanceof SearchProviderError
              ? error.retryAfterMs
              : undefined
          // `retrySearchOperation` uses `maxRetries: 2` under the hood
          // (initial + 2 retries).
          const maxAttempts = 3
          const eventAttrs: Record<string, string | number> = {
            'search.retry.provider': provider,
            'search.retry.attempt': attempt,
            'search.retry.max_attempts': maxAttempts,
            'search.retry.delay_ms': delayMs,
            'search.retry.error_message': truncateErrorMessage(error)
          }
          if (typeof status === 'number') {
            eventAttrs['search.retry.status_code'] = status
          }
          if (typeof retryAfterMs === 'number') {
            eventAttrs['search.retry.retry_after_ms'] = retryAfterMs
          }
          trace.getActiveSpan()?.addEvent('search.retry', eventAttrs)
        }
      }

      const executeSearch = async (
        provider: SearchProviderType
      ): Promise<SearchResults> => {
        const telemetryHook = makeTelemetryHook(provider)
        if (
          provider === 'searxng' &&
          effectiveSearchDepthForAPI === 'advanced'
        ) {
          return await runAdvancedSearch({
            query: filledQuery,
            maxResults: effectiveMaxResults,
            searchDepth: effectiveSearchDepthForAPI,
            includeDomains: include_domains,
            excludeDomains: exclude_domains
          })
        }

        const searchProvider = createSearchProvider(provider)
        if (provider === 'brave') {
          return await searchProvider.search(
            filledQuery,
            effectiveMaxResults,
            effectiveSearchDepthForAPI,
            include_domains,
            exclude_domains,
            {
              type: type as 'general' | 'optimized',
              content_types: content_types as Array<
                'web' | 'video' | 'image' | 'news'
              >
            },
            telemetryHook
          )
        }
        return await searchProvider.search(
          filledQuery,
          effectiveMaxResults,
          effectiveSearchDepthForAPI,
          include_domains,
          exclude_domains,
          undefined,
          telemetryHook
        )
      }

      if (searchProviders.length === 0) {
        throw new Error(
          formatSearchFailureMessage(
            `No configured search providers available for ${searchAPI}`
          )
        )
      }

      const providerErrors: string[] = []

      for (const [index, provider] of searchProviders.entries()) {
        providersAttempted.push(provider)
        try {
          searchResult = await executeSearch(provider)
          break
        } catch (providerError) {
          if (context?.abortSignal?.aborted) return

          const providerMessage =
            providerError instanceof Error
              ? providerError.message
              : 'Unknown search error'
          providerErrors.push(`${provider}: ${providerMessage}`)

          const failureType = isRetryableSearchError(providerError)
            ? 'transient'
            : providerError instanceof SearchProviderError
              ? 'permanent'
              : 'unknown'

          const nextProvider = searchProviders[index + 1]
          if (nextProvider) {
            console.warn(
              `[Search] Provider ${provider} failed (${failureType}${providerError instanceof SearchProviderError ? `, status=${providerError.status}` : ''}): ${providerMessage}. Falling back to ${nextProvider}.`
            )
            totalFallbacks += 1
            const fallbackAttrs: Record<string, string | number> = {
              'search.fallback.from': provider,
              'search.fallback.to': nextProvider,
              'search.fallback.reason': failureType
            }
            if (
              providerError instanceof SearchProviderError &&
              typeof providerError.status === 'number'
            ) {
              fallbackAttrs['search.fallback.error_code'] = providerError.status
            }
            trace.getActiveSpan()?.addEvent('search.fallback', fallbackAttrs)
            if (isRetryableSearchError(providerError)) {
              await new Promise<void>(resolve => {
                if (context?.abortSignal?.aborted) {
                  resolve()
                  return
                }
                const timer = setTimeout(resolve, 300)
                context?.abortSignal?.addEventListener(
                  'abort',
                  () => {
                    clearTimeout(timer)
                    resolve()
                  },
                  { once: true }
                )
              })
              if (context?.abortSignal?.aborted) return
            }
            continue
          }

          console.error(
            `[Search] Search providers failed in order: ${providerErrors.join(' -> ')}`
          )
        }
      }

      if (!searchResult) {
        // Emit exhausted aggregate telemetry before throwing so Phoenix
        // still receives the turn summary.
        trace.getActiveSpan()?.setAttributes({
          'search.turn.providers_attempted': providersAttempted,
          'search.turn.total_retries': totalRetries,
          'search.turn.total_fallbacks': totalFallbacks,
          'search.turn.final_provider':
            providersAttempted[providersAttempted.length - 1] ?? '',
          'search.turn.outcome': 'exhausted'
        })
        throw new Error(
          formatSearchFailureMessage(
            providerErrors.length > 0
              ? `Search failed across providers (${providerErrors.join(' -> ')})`
              : `Search failed before any provider could run for ${searchAPI}`
          )
        )
      }

      // Add citation mapping and toolCallId to search results
      if (searchResult.results && searchResult.results.length > 0) {
        const citationMap: Record<number, SearchResultItem> = {}
        searchResult.results.forEach((result, index) => {
          citationMap[index + 1] = result // Citation numbers start at 1
        })
        searchResult.citationMap = citationMap
      }

      // Add toolCallId from context
      if (context?.toolCallId) {
        searchResult.toolCallId = context.toolCallId
      }

      const usedProvider = searchProviders[providerErrors.length]
      if (providerErrors.length > 0) {
        console.log(
          `[Search] Completed via ${usedProvider} after ${providerErrors.length} fallback(s)`
        )
      } else {
        console.log(`[Search] Completed via ${usedProvider}`)
      }

      // Emit turn-aggregate telemetry on the active span before yielding
      // the final complete state. No-op when tracing is disabled.
      trace.getActiveSpan()?.setAttributes({
        'search.turn.providers_attempted': providersAttempted,
        'search.turn.total_retries': totalRetries,
        'search.turn.total_fallbacks': totalFallbacks,
        'search.turn.final_provider': usedProvider,
        'search.turn.outcome': 'success'
      })

      // Yield final results with complete state
      yield {
        state: 'complete' as const,
        ...searchResult
      }
    }
  })
}

// Default export for backward compatibility, using a default model
export const searchTool = createSearchTool(
  'gateway:xai/grok-4.1-fast-non-reasoning'
)

export const serverTool = searchTool

// Export type for UI tool invocation
export type SearchUIToolInvocation = UIToolInvocation<typeof searchTool>

export async function search(
  query: string,
  maxResults: number = 10,
  searchDepth: 'basic' | 'advanced' = 'basic',
  includeDomains: string[] = [],
  excludeDomains: string[] = []
): Promise<SearchResults> {
  const result = await searchTool.execute?.(
    {
      query,
      type: 'general',
      content_types: ['web'],
      max_results: maxResults,
      search_depth: searchDepth,
      include_domains: includeDomains,
      exclude_domains: excludeDomains
    },
    {
      toolCallId: 'search',
      messages: []
    }
  )

  if (!result) {
    return { results: [], images: [], query, number_of_results: 0 }
  }

  // Handle AsyncIterable case
  if (Symbol.asyncIterator in result) {
    // Collect all results from the async iterable
    let searchResults: SearchResults | null = null
    for await (const chunk of result) {
      // Only assign when we get the complete result
      if ('state' in chunk && chunk.state === 'complete') {
        const { state, ...rest } = chunk
        searchResults = rest as SearchResults
      }
    }
    return (
      searchResults ?? { results: [], images: [], query, number_of_results: 0 }
    )
  }

  return result as SearchResults
}
