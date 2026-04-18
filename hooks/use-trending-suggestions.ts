import { useEffect, useRef, useState } from 'react'

import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'
import type { TrendingSuggestionsResponse } from '@/lib/types'

const RETRY_DELAY_MS = 10000

const PLACEHOLDER_RESPONSE: TrendingSuggestionsResponse = {
  suggestions: DEFAULT_SUGGESTIONS,
  meta: {
    source: 'default',
    serveMode: 'placeholder',
    servedFrom: 'placeholder',
    generatedAt: null,
    isFallback: true,
    failureReason: null
  }
}

export function useTrendingSuggestions() {
  const [state, setState] =
    useState<TrendingSuggestionsResponse>(PLACEHOLDER_RESPONSE)
  const retryTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const clearRetry = () => {
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }

    const loadSuggestions = async () => {
      try {
        const response = await fetch('/api/suggestions', {
          cache: 'no-store',
          signal: controller.signal
        })
        const data = (await response.json()) as TrendingSuggestionsResponse

        setState(data)
        clearRetry()

        if (data.meta.isFallback) {
          retryTimeoutRef.current = window.setTimeout(() => {
            void loadSuggestions()
          }, RETRY_DELAY_MS)
        }
      } catch {
        // Keep placeholder suggestions on error.
      }
    }

    void loadSuggestions()

    return () => {
      controller.abort()
      clearRetry()
    }
  }, [])

  return state
}
