import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const originalEnv = { ...process.env }

async function importFresh() {
  vi.resetModules()
  return import('../get-directions')
}

async function execute(params: unknown) {
  const { getDirectionsTool } = await importFresh()
  const executeFn = getDirectionsTool.execute
  if (!executeFn) throw new Error('no execute')
  return executeFn(
    params as never,
    {
      toolCallId: 'test',
      messages: []
    } as never
  )
}

describe('getDirectionsTool', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  it('returns a driving route with geometry and labels', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          routes: [
            {
              duration: 3456,
              distance: 45123,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-118.4, 33.94],
                  [-118.3, 34.0],
                  [-118.24, 34.05]
                ]
              }
            }
          ]
        })
    })

    const result = await execute({
      origin: { lat: 33.94, lng: -118.4 },
      destination: { lat: 34.05, lng: -118.24 },
      profile: 'driving'
    })

    expect(result).toEqual({
      state: 'success',
      profile: 'driving',
      duration: 3456,
      distance: 45123,
      durationLabel: '58 min',
      distanceLabel: '28.0 mi',
      points: [
        { lat: 33.94, lng: -118.4 },
        { lat: 34.0, lng: -118.3 },
        { lat: 34.05, lng: -118.24 }
      ]
    })
  })

  it('calls MapTiler with driving profile and correct coord order', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          routes: [
            {
              duration: 10,
              distance: 100,
              geometry: { type: 'LineString', coordinates: [[0, 0]] }
            }
          ]
        })
    })

    await execute({
      origin: { lat: 10, lng: 20 },
      destination: { lat: 30, lng: 40 },
      profile: 'driving'
    })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/directions/v1/driving/')
    expect(calledUrl).toContain('20,10;40,30')
    expect(calledUrl).toContain('geometries=geojson')
    expect(calledUrl).toContain('key=test-key')
  })

  it('includes waypoints in the URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          routes: [
            {
              duration: 1,
              distance: 1,
              geometry: { type: 'LineString', coordinates: [[0, 0]] }
            }
          ]
        })
    })

    await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 2, lng: 2 },
      waypoints: [{ lat: 1, lng: 1 }],
      profile: 'walking'
    })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/directions/v1/walking/')
    expect(calledUrl).toContain('0,0;1,1;2,2')
  })

  it('returns NOT_SUPPORTED for transit profile without calling MapTiler', async () => {
    const result = await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      profile: 'transit'
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      state: 'not_supported',
      profile: 'transit'
    })
    expect((result as { message: string }).message).toMatch(/transit/i)
  })

  it('returns error state when MapTiler returns 403', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden')
    })

    const result = await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      profile: 'driving'
    })

    expect(result).toMatchObject({ state: 'error' })
  })

  it('returns error state when MapTiler returns no routes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ routes: [] })
    })

    const result = await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      profile: 'driving'
    })

    expect(result).toMatchObject({ state: 'error' })
  })

  it('formats duration labels below 60 seconds as seconds', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          routes: [
            {
              duration: 45,
              distance: 50,
              geometry: { type: 'LineString', coordinates: [[0, 0]] }
            }
          ]
        })
    })

    const result = await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      profile: 'walking'
    })

    expect((result as { durationLabel: string }).durationLabel).toBe('45 sec')
  })

  it('formats distance labels below 0.1 mi as feet', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          routes: [
            {
              duration: 60,
              distance: 50,
              geometry: { type: 'LineString', coordinates: [[0, 0]] }
            }
          ]
        })
    })

    const result = await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      profile: 'walking'
    })

    expect((result as { distanceLabel: string }).distanceLabel).toBe('164 ft')
  })
})
