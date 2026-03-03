import { useEffect, useState } from 'react'

import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'

export function useTrendingSuggestions() {
  const [suggestions, setSuggestions] =
    useState<Record<string, string[]>>(DEFAULT_SUGGESTIONS)

  useEffect(() => {
    fetch('/api/suggestions')
      .then(res => res.json())
      .then(data => setSuggestions(data))
      .catch(() => {
        // Keep static fallback on error — already set as initial state
      })
  }, [])

  return { suggestions }
}
