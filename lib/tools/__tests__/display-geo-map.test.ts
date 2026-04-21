import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { displayGeoMapTool } from '../display-geo-map'

const schema = displayGeoMapTool.inputSchema as z.ZodTypeAny

describe('displayGeoMapTool input schema', () => {
  it('accepts a minimal marker-only payload', () => {
    const result = schema.safeParse({
      id: 'm-1',
      markers: [{ id: 'a', lat: 34.05, lng: -118.24 }]
    })

    expect(result.success).toBe(true)
  })

  it('accepts markers, routes, clustering, and fit viewport', () => {
    const result = schema.safeParse({
      id: 'fleet',
      title: 'Fleet',
      markers: [
        {
          id: 'truck-14',
          lat: 34.05,
          lng: -118.24,
          label: 'Truck 14',
          icon: { type: 'emoji', value: '🚚' }
        }
      ],
      routes: [
        {
          id: 'r1',
          points: [
            { lat: 33.94, lng: -118.4 },
            { lat: 34.05, lng: -118.24 }
          ],
          color: '#2563EB'
        }
      ],
      clustering: { enabled: true },
      viewport: {
        mode: 'fit',
        target: 'all',
        padding: 40,
        maxZoom: 11
      }
    })

    expect(result.success).toBe(true)
  })

  it('accepts a center viewport', () => {
    const result = schema.safeParse({
      id: 'm-2',
      markers: [{ id: 'a', lat: 0, lng: 0 }],
      viewport: { mode: 'center', center: { lat: 0, lng: 0 }, zoom: 4 }
    })

    expect(result.success).toBe(true)
  })

  it('rejects out-of-range latitude', () => {
    const result = schema.safeParse({
      id: 'm-3',
      markers: [{ id: 'a', lat: 100, lng: 0 }]
    })

    expect(result.success).toBe(false)
  })

  it('rejects empty markers array', () => {
    const result = schema.safeParse({ id: 'm-4', markers: [] })

    expect(result.success).toBe(false)
  })

  it('rejects a route with fewer than two points', () => {
    const result = schema.safeParse({
      id: 'm-5',
      markers: [{ id: 'a', lat: 0, lng: 0 }],
      routes: [{ id: 'r', points: [{ lat: 0, lng: 0 }] }]
    })

    expect(result.success).toBe(false)
  })

  it('rejects duplicate marker ids', () => {
    const result = schema.safeParse({
      id: 'm-6',
      markers: [
        { id: 'dup', lat: 34.05, lng: -118.24 },
        { id: 'dup', lat: 37.77, lng: -122.42 }
      ]
    })

    expect(result.success).toBe(false)
  })

  it('rejects duplicate route ids', () => {
    const result = schema.safeParse({
      id: 'm-7',
      markers: [{ id: 'a', lat: 34.05, lng: -118.24 }],
      routes: [
        {
          id: 'dup-route',
          points: [
            { lat: 34.05, lng: -118.24 },
            { lat: 34.06, lng: -118.23 }
          ]
        },
        {
          id: 'dup-route',
          points: [
            { lat: 37.77, lng: -122.42 },
            { lat: 37.78, lng: -122.41 }
          ]
        }
      ]
    })

    expect(result.success).toBe(false)
  })

  it('rejects non-http image icon URLs', () => {
    const result = schema.safeParse({
      id: 'm-8',
      markers: [
        {
          id: 'a',
          lat: 34.05,
          lng: -118.24,
          icon: { type: 'image', url: 'ftp://example.com/icon.png' }
        }
      ]
    })

    expect(result.success).toBe(false)
  })

  it('passes valid payloads through execute', async () => {
    const payload = {
      id: 'm-9',
      markers: [{ id: 'a', lat: 34.05, lng: -118.24 }],
      viewport: { mode: 'fit' as const, target: 'markers' as const }
    }

    if (!displayGeoMapTool.execute) {
      throw new Error('displayGeoMapTool.execute is not defined')
    }

    await expect(displayGeoMapTool.execute(payload, {} as never)).resolves.toBe(
      payload
    )
  })
})
