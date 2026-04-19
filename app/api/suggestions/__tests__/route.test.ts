import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dayOfEpoch,
  selectDailySuggestionsFromPool,
  SUGGESTION_POOL
} from '@/lib/constants/default-suggestions'

const mockGenerateTrendingSuggestions = vi.fn()
const mockLimit = vi.fn()

vi.mock('@/lib/agents/generate-trending-suggestions', () => ({
  generateTrendingSuggestions: (...args: unknown[]) =>
    mockGenerateTrendingSuggestions(...args)
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: (...args: unknown[]) => mockLimit(...args)
        })
      })
    })
  }
}))

vi.mock('@/lib/utils/telemetry', () => ({
  flushTraces: vi.fn()
}))

import { GET } from '../route'

describe('GET /api/suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('serves rotated static pool when the cache row is empty', async () => {
    mockLimit.mockResolvedValueOnce([])

    const response = await GET()
    const json = await response.json()

    expect(response.headers.get('x-suggestions-source')).toBe('static-rotation')
    expect(response.headers.get('cache-control')).toContain('s-maxage=21600')
    expect(response.headers.get('cache-control')).toContain(
      'stale-while-revalidate=86400'
    )
    expect(json).toEqual(selectDailySuggestionsFromPool(dayOfEpoch()))
  })

  it('blends 2 dynamic + 2 static per category when cache row exists', async () => {
    const dynamic = {
      research: ['dyn-r-1', 'dyn-r-2', 'dyn-r-3', 'dyn-r-4'],
      compare: ['dyn-c-1', 'dyn-c-2', 'dyn-c-3', 'dyn-c-4'],
      latest: ['dyn-l-1', 'dyn-l-2', 'dyn-l-3', 'dyn-l-4'],
      summarize: ['dyn-s-1', 'dyn-s-2', 'dyn-s-3', 'dyn-s-4'],
      explain: ['dyn-e-1', 'dyn-e-2', 'dyn-e-3', 'dyn-e-4']
    }
    mockLimit.mockResolvedValueOnce([{ suggestions: dynamic }])

    const response = await GET()
    const json = await response.json()

    expect(response.headers.get('x-suggestions-source')).toBe('dynamic-blend')

    const rotated = selectDailySuggestionsFromPool(dayOfEpoch())
    expect(json.research).toEqual([
      'dyn-r-1',
      'dyn-r-2',
      rotated.research[0],
      rotated.research[1]
    ])
    expect(json.latest).toEqual([
      'dyn-l-1',
      'dyn-l-2',
      rotated.latest[0],
      rotated.latest[1]
    ])
    expect(json.research).toHaveLength(4)
    expect(json.compare).toHaveLength(4)
    expect(json.latest).toHaveLength(4)
    expect(json.summarize).toHaveLength(4)
    expect(json.explain).toHaveLength(4)
  })

  it('falls back to static rotation when DB read throws', async () => {
    mockLimit.mockRejectedValueOnce(new Error('pg dead'))

    const response = await GET()
    const json = await response.json()

    expect(response.headers.get('x-suggestions-source')).toBe('static-rotation')
    expect(json).toEqual(selectDailySuggestionsFromPool(dayOfEpoch()))
  })

  it('never invokes generateTrendingSuggestions (hot-path isolation)', async () => {
    mockLimit.mockResolvedValueOnce([])
    await GET()
    mockLimit.mockResolvedValueOnce([
      {
        suggestions: {
          research: ['a', 'b', 'c', 'd'],
          compare: ['a', 'b', 'c', 'd'],
          latest: ['a', 'b', 'c', 'd'],
          summarize: ['a', 'b', 'c', 'd'],
          explain: ['a', 'b', 'c', 'd']
        }
      }
    ])
    await GET()
    mockLimit.mockRejectedValueOnce(new Error('boom'))
    await GET()

    expect(mockGenerateTrendingSuggestions).not.toHaveBeenCalled()
  })
})

describe('selectDailySuggestionsFromPool', () => {
  it('is deterministic per-day seed', () => {
    const a = selectDailySuggestionsFromPool(42)
    const b = selectDailySuggestionsFromPool(42)
    expect(a).toEqual(b)
  })

  it('rotates when the seed changes', () => {
    const day1 = selectDailySuggestionsFromPool(42)
    const day2 = selectDailySuggestionsFromPool(43)
    const diffs = (Object.keys(day1) as Array<keyof typeof day1>).filter(
      category =>
        JSON.stringify(day1[category]) !== JSON.stringify(day2[category])
    )
    expect(diffs.length).toBeGreaterThan(0)
  })

  it('draws all items from the pool', () => {
    const result = selectDailySuggestionsFromPool(1)
    for (const category of Object.keys(result) as Array<keyof typeof result>) {
      for (const item of result[category]) {
        expect(SUGGESTION_POOL[category]).toContain(item)
      }
    }
  })

  it('returns 4 per category by default', () => {
    const result = selectDailySuggestionsFromPool(1)
    expect(result.research).toHaveLength(4)
    expect(result.compare).toHaveLength(4)
    expect(result.latest).toHaveLength(4)
    expect(result.summarize).toHaveLength(4)
    expect(result.explain).toHaveLength(4)
  })

  it('keeps the latest static pool aligned to current fallback topics', () => {
    expect(SUGGESTION_POOL.latest).toEqual(
      expect.arrayContaining([
        'Waymo robotaxi rollout across 10 U.S. markets',
        'Webb update on asteroid 2024 YR4',
        'Nvidia H20 export controls latest',
        'AI chip smuggling case tied to China',
        'Malaria vaccine rollout across 25 countries'
      ])
    )

    expect(SUGGESTION_POOL.latest).not.toEqual(
      expect.arrayContaining([
        'Tesla Full Self-Driving real-world performance data',
        'NVIDIA Blackwell supply chain update',
        'Recent Apple Vision Pro adoption data',
        'Latest moves in the WGA vs AI training lawsuits'
      ])
    )
  })
})
