import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckCanvasLimit = vi.fn()
vi.mock('@/lib/rate-limit/canvas-limits', () => ({
  checkAndEnforceCanvasLimit: (...args: unknown[]) =>
    mockCheckCanvasLimit(...args)
}))

const mockSearch = vi.fn()
const mockCreateSearchProvider = vi.fn()
vi.mock('@/lib/tools/search/providers', () => ({
  createSearchProvider: (...args: unknown[]) =>
    mockCreateSearchProvider(...args)
}))

import { GET } from './route'

function makeRequest(url: string, xForwardedFor?: string) {
  return new Request(url, {
    headers: xForwardedFor
      ? {
          'x-forwarded-for': xForwardedFor
        }
      : undefined
  })
}

describe('GET /api/canvas-assets/image-proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckCanvasLimit.mockResolvedValue(null)
    mockCreateSearchProvider.mockReturnValue({
      search: mockSearch
    })
  })

  it('returns 400 when q is missing', async () => {
    const response = await GET(
      makeRequest('http://localhost/api/canvas-assets/image-proxy')
    )

    expect(response.status).toBe(400)
  })

  it('returns 400 when q is blank', async () => {
    const response = await GET(
      makeRequest('http://localhost/api/canvas-assets/image-proxy?q=   ')
    )

    expect(response.status).toBe(400)
  })

  it('returns 400 when q exceeds the allowed length', async () => {
    const response = await GET(
      makeRequest(
        `http://localhost/api/canvas-assets/image-proxy?q=${'a'.repeat(201)}`
      )
    )

    expect(response.status).toBe(400)
  })

  it('returns 404 when Brave returns no image thumbnails', async () => {
    mockSearch.mockResolvedValue({
      images: [],
      results: [],
      videos: [],
      number_of_results: 0
    })

    const response = await GET(
      makeRequest('http://localhost/api/canvas-assets/image-proxy?q=cat')
    )

    expect(response.status).toBe(404)
    expect(mockSearch).toHaveBeenCalledWith(
      'cat',
      expect.any(Number),
      'basic',
      [],
      [],
      {
        type: 'general',
        content_types: ['image']
      }
    )
  })

  it('returns 404 when the thumbnail target is unsafe', async () => {
    mockSearch.mockResolvedValue({
      images: [
        {
          url: 'http://127.0.0.1:3000/image.png'
        }
      ],
      results: [],
      videos: [],
      number_of_results: 1
    })

    const response = await GET(
      makeRequest('http://localhost/api/canvas-assets/image-proxy?q=cat')
    )

    expect(response.status).toBe(404)
  })

  it('returns 404 for IPv4-mapped IPv6 loopback thumbnails', async () => {
    mockSearch.mockResolvedValue({
      images: [
        {
          url: 'https://[::ffff:127.0.0.1]/image.png'
        }
      ],
      results: [],
      videos: [],
      number_of_results: 1
    })

    const response = await GET(
      makeRequest('http://localhost/api/canvas-assets/image-proxy?q=cat')
    )

    expect(response.status).toBe(404)
  })

  it('falls back to local-dev when x-forwarded-for is malformed', async () => {
    mockSearch.mockResolvedValue({
      images: [
        {
          url: 'https://images.example.com/cat.png'
        }
      ],
      results: [],
      videos: [],
      number_of_results: 1
    })

    await GET(
      makeRequest(
        'http://localhost/api/canvas-assets/image-proxy?q=cat',
        'definitely-not-an-ip'
      )
    )

    expect(mockCheckCanvasLimit).toHaveBeenCalledWith(
      'local-dev',
      'image-proxy'
    )
  })

  it('returns 502 when the provider fails', async () => {
    mockSearch.mockRejectedValue(new Error('Brave failed'))

    const response = await GET(
      makeRequest('http://localhost/api/canvas-assets/image-proxy?q=cat')
    )

    expect(response.status).toBe(502)
  })

  it('redirects to the first safe thumbnail and sets private cache headers', async () => {
    mockSearch.mockResolvedValue({
      images: [
        {
          url: 'https://images.example.com/cat.png'
        }
      ],
      results: [],
      videos: [],
      number_of_results: 1
    })

    const response = await GET(
      makeRequest(
        'http://localhost/api/canvas-assets/image-proxy?q=cat',
        '203.0.113.7'
      )
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(
      'https://images.example.com/cat.png'
    )
    expect(response.headers.get('Cache-Control')).toBe(
      'private, max-age=3600, stale-while-revalidate=86400'
    )
    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false)
  })
})
