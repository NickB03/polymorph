import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

async function importFresh() {
  vi.resetModules()
  return import('../get-static-map-image')
}

async function execute(params: unknown) {
  const { getStaticMapImageTool } = await importFresh()
  const executeFn = getStaticMapImageTool.execute
  if (!executeFn) throw new Error('no execute')
  return executeFn(
    params as never,
    {
      toolCallId: 'test',
      messages: []
    } as never
  )
}

describe('getStaticMapImageTool', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  it('builds a centered static map URL in light theme by default', async () => {
    const result = await execute({
      center: { lat: 37.7749, lng: -122.4194 },
      zoom: 12,
      width: 600,
      height: 400
    })

    expect(result).toEqual({
      state: 'success',
      imageUrl:
        'https://api.maptiler.com/maps/streets-v2/static/-122.4194,37.7749,12/600x400.png?key=test-key'
    })
  })

  it('uses the dark style when theme is dark', async () => {
    const result = await execute({
      center: { lat: 0, lng: 0 },
      zoom: 5,
      width: 200,
      height: 200,
      theme: 'dark'
    })

    expect((result as { imageUrl: string }).imageUrl).toContain(
      '/maps/streets-v2-dark/static/'
    )
  })

  it('appends markers when provided', async () => {
    const result = await execute({
      center: { lat: 0, lng: 0 },
      zoom: 10,
      width: 400,
      height: 300,
      markers: [
        { lat: 1.23, lng: 4.56, color: 'red' },
        { lat: -2.1, lng: 3.4 }
      ]
    })

    const imageUrl = (result as { imageUrl: string }).imageUrl
    expect(imageUrl).toContain('markers=')
    expect(imageUrl).toContain('icon-red:4.56,1.23')
    expect(imageUrl).toContain('icon-blue:3.4,-2.1')
  })

  it('returns error when api key is missing', async () => {
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY

    const result = await execute({
      center: { lat: 0, lng: 0 },
      zoom: 10,
      width: 100,
      height: 100
    })

    expect(result).toMatchObject({ state: 'error' })
  })

  it('clamps width and height to MapTiler max (2048)', async () => {
    const result = await execute({
      center: { lat: 0, lng: 0 },
      zoom: 10,
      width: 5000,
      height: 5000
    })

    const imageUrl = (result as { imageUrl: string }).imageUrl
    expect(imageUrl).toContain('2048x2048.png')
  })
})
