import { describe, expect, it } from 'vitest'

import { DisplayGeoMapSchema } from '@/lib/tools/display-geo-map'

import { safeParseSerializableGeoMap } from '../schema'

const parityCases = [
  {
    name: 'minimal',
    expected: true,
    payload: {
      id: 'minimal',
      markers: [{ id: 'a', lat: 0, lng: 0 }]
    }
  },
  {
    name: 'fleet',
    expected: true,
    payload: {
      id: 'fleet',
      title: 'Fleet',
      markers: [
        {
          id: 'truck-14',
          lat: 34.05,
          lng: -118.24,
          label: 'Truck 14',
          icon: { type: 'emoji', value: 'truck' }
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
        mode: 'fit' as const,
        target: 'all' as const,
        padding: 40,
        maxZoom: 11
      }
    }
  },
  {
    name: 'duplicate-marker-ids',
    expected: false,
    payload: {
      id: 'dup-markers',
      markers: [
        { id: 'dup', lat: 34.05, lng: -118.24 },
        { id: 'dup', lat: 37.77, lng: -122.42 }
      ]
    }
  },
  {
    name: 'duplicate-route-ids',
    expected: false,
    payload: {
      id: 'dup-routes',
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
    }
  },
  {
    name: 'non-http-image-icon',
    expected: false,
    payload: {
      id: 'bad-icon-url',
      markers: [
        {
          id: 'a',
          lat: 34.05,
          lng: -118.24,
          icon: { type: 'image', url: 'ftp://example.com/icon.png' }
        }
      ]
    }
  }
] as const

describe('geo-map schema parity', () => {
  for (const testCase of parityCases) {
    it(`keeps agent-side and client-side schemas aligned for ${testCase.name}`, () => {
      const agentAccepts = DisplayGeoMapSchema.safeParse(
        testCase.payload
      ).success
      const clientAccepts =
        safeParseSerializableGeoMap(testCase.payload) !== null

      expect(agentAccepts).toBe(testCase.expected)
      expect(clientAccepts).toBe(testCase.expected)
      expect(agentAccepts).toBe(clientAccepts)
    })
  }
})
