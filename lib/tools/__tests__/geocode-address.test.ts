import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const originalEnv = { ...process.env }

async function importFresh() {
  vi.resetModules()
  return import('../geocode-address')
}

async function execute(params: unknown) {
  const { geocodeAddressTool } = await importFresh()
  const executeFn = geocodeAddressTool.execute
  if (!executeFn) throw new Error('no execute')
  return executeFn(
    params as never,
    {
      toolCallId: 'test',
      messages: []
    } as never
  )
}

describe('geocodeAddressTool', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  it('returns lat/lng and formatted place name for a match', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              place_name_en: 'Eiffel Tower, Paris, France',
              center: [2.2945, 48.8584],
              place_type: ['poi']
            }
          ]
        })
    })

    const result = await execute({ query: 'Eiffel Tower' })

    expect(result).toEqual({
      state: 'success',
      results: [
        {
          lat: 48.8584,
          lng: 2.2945,
          placeName: 'Eiffel Tower, Paris, France',
          placeType: 'poi'
        }
      ]
    })
  })

  it('URL-encodes the query and respects limit', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              place_name_en: 'A',
              center: [0, 0],
              place_type: ['address']
            }
          ]
        })
    })

    await execute({ query: 'café w/ space & comma', limit: 3 })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/geocoding/')
    expect(calledUrl).toContain(encodeURIComponent('café w/ space & comma'))
    expect(calledUrl).toContain('limit=3')
  })

  it('returns not_found when features is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ features: [] })
    })

    const result = await execute({ query: 'zzznowhere' })

    expect(result).toMatchObject({
      state: 'not_found',
      query: 'zzznowhere'
    })
  })

  it('falls back to place_name when place_name_en is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              place_name: 'Somewhere',
              center: [1, 2],
              place_type: ['region']
            }
          ]
        })
    })

    const result = await execute({ query: 'x' })
    expect(
      (
        result as {
          results: Array<{ placeName: string }>
        }
      ).results[0].placeName
    ).toBe('Somewhere')
  })

  it('returns error on api failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('boom')
    })

    const result = await execute({ query: 'x' })
    expect(result).toMatchObject({ state: 'error' })
  })
})
