import { tool } from 'ai'
import { z } from 'zod'

import { fetchMapTilerJson, MapTilerApiError } from './maptiler/client'

const GeocodeAddressInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(256)
    .describe(
      'Free-form place query — an address, POI name, neighborhood, city, landmark. Example: "2450 Mission St, SF" or "Eiffel Tower".'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .describe(
      'Maximum number of geocoding candidates to return. Default 1. Use >1 when the query is ambiguous (e.g. "Springfield" — there are many).'
    )
})

type MapTilerGeocodingResponse = {
  features?: Array<{
    place_name?: string
    place_name_en?: string
    center?: [number, number]
    place_type?: string[]
  }>
}

type GeocodeResult = {
  lat: number
  lng: number
  placeName: string
  placeType: string
}

export type GeocodeAddressResult =
  | { state: 'success'; results: GeocodeResult[] }
  | { state: 'not_found'; query: string }
  | { state: 'error'; message: string }

export const geocodeAddressTool = tool({
  description:
    'Resolve a place query (address, POI name, city, landmark) into precise latitude/longitude coordinates. Use this BEFORE calling displayGeoMap or getDirections whenever the user refers to a place by name or address — do not guess coordinates from memory. Returns up to `limit` candidates ranked by MapTiler relevance.',
  inputSchema: GeocodeAddressInputSchema,
  execute: async (input): Promise<GeocodeAddressResult> => {
    const limit = input.limit ?? 1
    const encoded = encodeURIComponent(input.query)
    const path = `/geocoding/${encoded}.json?limit=${limit}`

    try {
      const response = await fetchMapTilerJson<MapTilerGeocodingResponse>(path)
      const features = response.features ?? []

      if (features.length === 0) {
        return { state: 'not_found', query: input.query }
      }

      const results = features
        .filter(
          (
            f
          ): f is {
            place_name?: string
            place_name_en?: string
            center: [number, number]
            place_type?: string[]
          } =>
            Array.isArray(f.center) &&
            f.center.length === 2 &&
            typeof f.center[0] === 'number' &&
            typeof f.center[1] === 'number'
        )
        .map(f => ({
          lat: f.center[1],
          lng: f.center[0],
          placeName:
            f.place_name_en ?? f.place_name ?? `${f.center[1]}, ${f.center[0]}`,
          placeType: f.place_type?.[0] ?? 'unknown'
        }))

      if (results.length === 0) {
        return { state: 'not_found', query: input.query }
      }

      return { state: 'success', results }
    } catch (error) {
      const message =
        error instanceof MapTilerApiError
          ? `MapTiler geocoding error ${error.status}: ${error.body.slice(0, 120)}`
          : error instanceof Error
            ? error.message
            : 'Unknown error from geocoding service.'
      return { state: 'error', message }
    }
  }
})
