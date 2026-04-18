import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SUGGESTIONS } from '@/lib/constants/default-suggestions'

import { useTrendingSuggestions } from './use-trending-suggestions'

describe('useTrendingSuggestions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps defaults as an initial placeholder and hydrates from the API payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          suggestions: {
            ...DEFAULT_SUGGESTIONS,
            latest: ['live 1', 'live 2', 'live 3', 'live 4']
          },
          meta: {
            source: 'brave',
            serveMode: 'fresh-generated',
            servedFrom: 'fresh-generated',
            generatedAt: '2026-04-17T16:00:00.000Z',
            isFallback: false,
            failureReason: null
          }
        })
      )
    )

    const { result } = renderHook(() => useTrendingSuggestions())

    expect(result.current.suggestions).toEqual(DEFAULT_SUGGESTIONS)

    await waitFor(() => {
      expect(result.current.suggestions.latest).toEqual([
        'live 1',
        'live 2',
        'live 3',
        'live 4'
      ])
    })
  })

  it('schedules a retry when the API returns fallback defaults', async () => {
    vi.useFakeTimers()

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          suggestions: DEFAULT_SUGGESTIONS,
          meta: {
            source: 'default',
            serveMode: 'fresh-generated',
            servedFrom: 'fresh-generated',
            generatedAt: null,
            isFallback: true,
            failureReason: 'search-provider-failed'
          }
        })
      )
    )

    renderHook(() => useTrendingSuggestions())

    await act(async () => {
      await Promise.resolve()
    })

    expect(fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
