import { describe, expect, it } from 'vitest'

import {
  parseSerializableGeoMap,
  safeParseSerializableGeoMap,
  SerializableGeoMapSchema
} from '../schema'

const validGeoMapPayload = {
  id: 'fleet-map',
  title: 'Fleet Positions',
  markers: [
    {
      id: 'truck-14',
      lat: 34.0522,
      lng: -118.2437,
      label: 'Truck 14',
      icon: { type: 'emoji' as const, value: '🚚' }
    }
  ]
}

describe('SerializableGeoMapSchema', () => {
  it('accepts a minimal marker payload', () => {
    const result = SerializableGeoMapSchema.safeParse(validGeoMapPayload)

    expect(result.success).toBe(true)
    expect(result.success && result.data).toEqual(validGeoMapPayload)
  })

  it('accepts markers, routes, clustering, and fit viewport data', () => {
    const payload = {
      id: 'fleet-with-routes',
      title: 'Fleet Routes',
      description: 'Routes across the west coast',
      markers: [
        {
          id: 'truck-14',
          lat: 34.0522,
          lng: -118.2437,
          label: 'Truck 14',
          tooltip: 'always' as const,
          icon: { type: 'emoji' as const, value: '🚚', size: 24 }
        },
        {
          id: 'truck-22',
          lat: 36.1699,
          lng: -115.1398,
          label: 'Truck 22',
          icon: { type: 'dot' as const, color: '#0EA5E9', radius: 8 }
        }
      ],
      routes: [
        {
          id: 'route-west-14',
          points: [
            { lat: 33.9416, lng: -118.4085 },
            { lat: 34.0522, lng: -118.2437 }
          ],
          color: '#2563EB',
          weight: 4,
          opacity: 0.9
        }
      ],
      clustering: {
        enabled: true,
        radius: 48,
        maxZoom: 12,
        minPoints: 2
      },
      viewport: {
        mode: 'fit' as const,
        target: 'all' as const,
        padding: 40,
        maxZoom: 11
      },
      showZoomControl: true,
      theme: 'dark' as const
    }

    expect(parseSerializableGeoMap(payload)).toEqual(payload)
    expect(safeParseSerializableGeoMap(payload)).toEqual(payload)
  })

  it('rejects duplicate marker ids', () => {
    expect(
      safeParseSerializableGeoMap({
        ...validGeoMapPayload,
        markers: [
          { id: 'truck-14', lat: 34.0522, lng: -118.2437 },
          { id: 'truck-14', lat: 36.1699, lng: -115.1398 }
        ]
      })
    ).toBeNull()
  })

  it('rejects duplicate route ids', () => {
    expect(
      safeParseSerializableGeoMap({
        ...validGeoMapPayload,
        routes: [
          {
            id: 'route-west-14',
            points: [
              { lat: 33.9416, lng: -118.4085 },
              { lat: 34.0522, lng: -118.2437 }
            ]
          },
          {
            id: 'route-west-14',
            points: [
              { lat: 34.0522, lng: -118.2437 },
              { lat: 36.1699, lng: -115.1398 }
            ]
          }
        ]
      })
    ).toBeNull()
  })

  it('rejects invalid coordinates and image icon URLs', () => {
    expect(
      safeParseSerializableGeoMap({
        ...validGeoMapPayload,
        markers: [
          {
            id: 'truck-14',
            lat: 91,
            lng: -118.2437
          }
        ]
      })
    ).toBeNull()

    expect(
      safeParseSerializableGeoMap({
        ...validGeoMapPayload,
        markers: [
          {
            id: 'truck-14',
            lat: 34.0522,
            lng: -118.2437,
            icon: {
              type: 'image' as const,
              url: 'ftp://example.com/truck.png'
            }
          }
        ]
      })
    ).toBeNull()
  })

  it('throws a readable parse error for invalid viewport payloads', () => {
    expect(() =>
      parseSerializableGeoMap({
        ...validGeoMapPayload,
        viewport: {
          mode: 'center' as const,
          center: { lat: 34.0522, lng: -118.2437 },
          zoom: 24
        }
      })
    ).toThrow(/zoom/i)
  })

  it('accepts valid polygons', () => {
    const result = safeParseSerializableGeoMap({
      ...validGeoMapPayload,
      polygons: [
        {
          points: [
            { lat: 0, lng: 0 },
            { lat: 1, lng: 1 },
            { lat: 0, lng: 1 }
          ],
          fillColor: '#2563EB'
        }
      ]
    })
    expect(result).not.toBeNull()
  })

  it('rejects polygons with fewer than 3 points', () => {
    const result = safeParseSerializableGeoMap({
      ...validGeoMapPayload,
      polygons: [
        {
          points: [
            { lat: 0, lng: 0 },
            { lat: 1, lng: 1 }
          ]
        }
      ]
    })
    expect(result).toBeNull()
  })

  it('rejects duplicate polygon ids', () => {
    const result = safeParseSerializableGeoMap({
      ...validGeoMapPayload,
      polygons: [
        {
          id: 'a',
          points: [
            { lat: 0, lng: 0 },
            { lat: 1, lng: 1 },
            { lat: 2, lng: 2 }
          ]
        },
        {
          id: 'a',
          points: [
            { lat: 3, lng: 3 },
            { lat: 4, lng: 4 },
            { lat: 5, lng: 5 }
          ]
        }
      ]
    })
    expect(result).toBeNull()
  })
})
