import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const originalEnv = { ...process.env }

async function importFresh() {
  vi.resetModules()
  return import('../get-isochrone')
}

async function execute(params: unknown) {
  const { getIsochroneTool } = await importFresh()
  const executeFn = getIsochroneTool.execute
  if (!executeFn) throw new Error('no execute')
  return executeFn(
    params as never,
    {
      toolCallId: 'test',
      messages: []
    } as never
  )
}

describe('getIsochroneTool', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env = { ...originalEnv }
    process.env.ORS_API_KEY = 'ors-test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  it('returns a polygon for a successful isochrone request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [-122.4, 37.7],
                    [-122.3, 37.8],
                    [-122.2, 37.7],
                    [-122.4, 37.7]
                  ]
                ]
              }
            }
          ]
        })
    })

    const result = await execute({
      center: { lat: 37.75, lng: -122.3 },
      durationMinutes: 30,
      profile: 'driving'
    })

    expect(result).toEqual({
      state: 'success',
      profile: 'driving',
      durationMinutes: 30,
      points: [
        { lat: 37.7, lng: -122.4 },
        { lat: 37.8, lng: -122.3 },
        { lat: 37.7, lng: -122.2 }
      ]
    })
  })

  it('calls ORS with driving-car profile and duration in seconds', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              geometry: {
                type: 'Polygon',
                coordinates: [[[0, 0]]]
              }
            }
          ]
        })
    })

    await execute({
      center: { lat: 0, lng: 0 },
      durationMinutes: 15,
      profile: 'driving'
    })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/v2/isochrones/driving-car')

    const calledInit = mockFetch.mock.calls[0][1] as RequestInit
    expect(calledInit.method).toBe('POST')
    expect((calledInit.headers as Record<string, string>).Authorization).toBe(
      'ors-test-key'
    )
    const body = JSON.parse(calledInit.body as string) as {
      locations: Array<[number, number]>
      range: number[]
      range_type: string
    }
    expect(body.locations).toEqual([[0, 0]])
    expect(body.range).toEqual([900])
    expect(body.range_type).toBe('time')
  })

  it('maps walking profile to foot-walking', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              geometry: {
                type: 'Polygon',
                coordinates: [[[0, 0]]]
              }
            }
          ]
        })
    })

    await execute({
      center: { lat: 0, lng: 0 },
      durationMinutes: 10,
      profile: 'walking'
    })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/v2/isochrones/foot-walking')
  })

  it('returns error when ORS_API_KEY is missing', async () => {
    delete process.env.ORS_API_KEY

    const result = await execute({
      center: { lat: 0, lng: 0 },
      durationMinutes: 10,
      profile: 'driving'
    })

    expect(result).toMatchObject({ state: 'error' })
    expect((result as { message: string }).message).toMatch(/ORS_API_KEY/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns error on non-200 response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited')
    })

    const result = await execute({
      center: { lat: 0, lng: 0 },
      durationMinutes: 10,
      profile: 'driving'
    })

    expect(result).toMatchObject({ state: 'error' })
  })
})
