import { tool } from 'ai'
import { z } from 'zod'

import { fetchWithRetry } from './fetch-with-retry'

const ORS_BASE_URL = 'https://api.openrouteservice.org'

const PROFILE_MAP = {
  driving: 'driving-car',
  walking: 'foot-walking',
  cycling: 'cycling-regular'
} as const

const LatitudeSchema = z.number().finite().min(-90).max(90)
const LongitudeSchema = z.number().finite().min(-180).max(180)

const GetIsochroneInputSchema = z.object({
  center: z
    .object({ lat: LatitudeSchema, lng: LongitudeSchema })
    .describe('Starting point from which reachability is measured.'),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(60)
    .describe(
      'Maximum travel time in minutes. Must be 1–60 (ORS free tier caps at 60-minute isochrones).'
    ),
  profile: z
    .enum(['driving', 'walking', 'cycling'])
    .describe('Travel mode used to compute reachability.')
})

type OrsIsochroneResponse = {
  features?: Array<{
    geometry?: {
      type: 'Polygon'
      coordinates: Array<Array<[number, number]>>
    }
  }>
}

type Point = { lat: number; lng: number }

export type GetIsochroneResult =
  | {
      state: 'success'
      profile: 'driving' | 'walking' | 'cycling'
      durationMinutes: number
      points: Point[]
    }
  | { state: 'error'; message: string }

export const getIsochroneTool = tool({
  description:
    'Compute an isochrone — a polygon outlining every point reachable from a center location within N minutes by car, on foot, or by bike. Useful for "where can I live and still commute in 30 min", "what restaurants are within a 15-min walk", and similar reachability questions. Pair with displayGeoMap by passing the returned points into polygons[]. Requires ORS_API_KEY env var.',
  inputSchema: GetIsochroneInputSchema,
  execute: async (input): Promise<GetIsochroneResult> => {
    const apiKey = process.env.ORS_API_KEY
    if (!apiKey) {
      return {
        state: 'error',
        message:
          'ORS_API_KEY is not set. Isochrones require a free OpenRouteService key — see docs/getting-started/ENVIRONMENT.md.'
      }
    }

    const orsProfile = PROFILE_MAP[input.profile]
    const url = `${ORS_BASE_URL}/v2/isochrones/${orsProfile}`

    try {
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          locations: [[input.center.lng, input.center.lat]],
          range: [input.durationMinutes * 60],
          range_type: 'time'
        })
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        return {
          state: 'error',
          message: `OpenRouteService returned ${response.status}: ${body.slice(0, 160)}`
        }
      }

      const json = (await response.json()) as OrsIsochroneResponse
      const ring = json.features?.[0]?.geometry?.coordinates?.[0]
      if (!ring || ring.length === 0) {
        return {
          state: 'error',
          message: 'Isochrone response contained no polygon geometry.'
        }
      }

      const open =
        ring.length > 1 &&
        ring[0][0] === ring[ring.length - 1][0] &&
        ring[0][1] === ring[ring.length - 1][1]
          ? ring.slice(0, -1)
          : ring

      return {
        state: 'success',
        profile: input.profile,
        durationMinutes: input.durationMinutes,
        points: open.map(([lng, lat]) => ({ lat, lng }))
      }
    } catch (error) {
      return {
        state: 'error',
        message:
          error instanceof Error ? error.message : 'Unknown isochrone error.'
      }
    }
  }
})
