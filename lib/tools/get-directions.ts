import { tool } from 'ai'
import { z } from 'zod'

import { fetchMapTilerJson, MapTilerApiError } from './maptiler/client'

const LatitudeSchema = z.number().finite().min(-90).max(90)
const LongitudeSchema = z.number().finite().min(-180).max(180)
const PointSchema = z.object({
  lat: LatitudeSchema,
  lng: LongitudeSchema
})

const GetDirectionsInputSchema = z.object({
  origin: PointSchema.describe('Starting point (lat/lng).'),
  destination: PointSchema.describe('Ending point (lat/lng).'),
  waypoints: z
    .array(PointSchema)
    .max(10)
    .optional()
    .describe(
      'Ordered intermediate stops between origin and destination (max 10).'
    ),
  profile: z
    .enum(['driving', 'walking', 'cycling', 'transit'])
    .describe(
      'Travel mode. driving/walking/cycling are routed via real street networks. transit is not yet supported and returns a NOT_SUPPORTED result.'
    )
})

type DirectionsInput = z.infer<typeof GetDirectionsInputSchema>

type MapTilerRouteResponse = {
  routes?: Array<{
    duration?: number
    distance?: number
    geometry?: {
      type: 'LineString'
      coordinates: Array<[number, number]>
    }
  }>
}

type Point = { lat: number; lng: number }

export type GetDirectionsResult =
  | {
      state: 'success'
      profile: 'driving' | 'walking' | 'cycling'
      duration: number
      distance: number
      durationLabel: string
      distanceLabel: string
      points: Point[]
    }
  | {
      state: 'not_supported'
      profile: 'transit'
      message: string
    }
  | {
      state: 'error'
      message: string
    }

function formatDurationLabel(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`
  const totalMinutes = Math.round(seconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`
}

function formatDistanceLabel(meters: number): string {
  const miles = meters / 1609.344
  if (miles < 0.1) {
    const feet = Math.round(meters * 3.28084)
    return `${feet} ft`
  }
  return `${miles.toFixed(1)} mi`
}

function buildCoordsPath(points: Point[]): string {
  return points.map(p => `${p.lng},${p.lat}`).join(';')
}

async function fetchRoute(
  input: DirectionsInput
): Promise<GetDirectionsResult> {
  const coords = buildCoordsPath([
    input.origin,
    ...(input.waypoints ?? []),
    input.destination
  ])
  const path = `/directions/v1/${input.profile}/${coords}?geometries=geojson&overview=full`

  try {
    const response = await fetchMapTilerJson<MapTilerRouteResponse>(path)
    const route = response.routes?.[0]
    if (
      !route ||
      typeof route.duration !== 'number' ||
      typeof route.distance !== 'number' ||
      !route.geometry?.coordinates?.length
    ) {
      return {
        state: 'error',
        message: `No route found between origin and destination via ${input.profile}.`
      }
    }

    const points: Point[] = route.geometry.coordinates.map(([lng, lat]) => ({
      lat,
      lng
    }))

    return {
      state: 'success',
      profile: input.profile as 'driving' | 'walking' | 'cycling',
      duration: route.duration,
      distance: route.distance,
      durationLabel: formatDurationLabel(route.duration),
      distanceLabel: formatDistanceLabel(route.distance),
      points
    }
  } catch (error) {
    const message =
      error instanceof MapTilerApiError
        ? `MapTiler directions API error ${error.status}: ${error.body.slice(0, 120)}`
        : error instanceof Error
          ? error.message
          : 'Unknown error from directions service.'
    return { state: 'error', message }
  }
}

export const getDirectionsTool = tool({
  description:
    'Compute a real road-following route between two or more points. Supports driving, walking, and cycling via MapTiler. Returns duration, distance, human-readable labels, and an ordered list of lat/lng points suitable for displayGeoMap routes[]. For public transit use the transit profile — it returns a structured NOT_SUPPORTED result that you should acknowledge to the user.',
  inputSchema: GetDirectionsInputSchema,
  execute: async (input): Promise<GetDirectionsResult> => {
    if (input.profile === 'transit') {
      return {
        state: 'not_supported',
        profile: 'transit',
        message:
          'Public transit routing is not yet available in this product. For transit directions, suggest the user open Google Maps or their local transit authority (e.g. MTA, BART, TfL) for real-time schedules and routes.'
      }
    }
    return fetchRoute(input)
  }
})
