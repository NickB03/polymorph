import { tool } from 'ai'
import { z } from 'zod'

import { buildPublicMapTilerUrl, MapTilerConfigError } from './maptiler/client'

const MAX_DIMENSION = 2048

const LatitudeSchema = z.number().finite().min(-90).max(90)
const LongitudeSchema = z.number().finite().min(-180).max(180)

const MarkerSchema = z.object({
  lat: LatitudeSchema,
  lng: LongitudeSchema,
  color: z
    .enum(['red', 'blue', 'green', 'orange', 'purple', 'yellow', 'black'])
    .optional()
    .describe('Named marker color (default blue).')
})

const GetStaticMapImageInputSchema = z.object({
  center: z
    .object({ lat: LatitudeSchema, lng: LongitudeSchema })
    .describe('Map center lat/lng.'),
  zoom: z
    .number()
    .min(1)
    .max(22)
    .describe(
      'Zoom level 1–22. City-scale is typically 11–13; neighborhood is 14–16.'
    ),
  width: z
    .number()
    .int()
    .min(32)
    .max(MAX_DIMENSION)
    .describe(
      'Image width in pixels (32–2048). Typical values: 800 for inline/social, 1200 for hero images. Do not request 2048 unless the user needs a wall-sized export — larger images cost more MapTiler tile-equivalents.'
    ),
  height: z
    .number()
    .int()
    .min(32)
    .max(MAX_DIMENSION)
    .describe(
      'Image height in pixels (32–2048). Typical values: 600 for inline/social, 800 for hero images. Do not request 2048 unless the user needs a wall-sized export.'
    ),
  theme: z
    .enum(['light', 'dark'])
    .optional()
    .describe('Basemap theme. Defaults to light.'),
  markers: z
    .array(MarkerSchema)
    .max(25)
    .optional()
    .describe('Up to 25 markers to overlay.')
})

export type GetStaticMapImageResult =
  | { state: 'success'; imageUrl: string }
  | { state: 'error'; message: string }

function clampDimension(value: number): number {
  return Math.min(MAX_DIMENSION, Math.max(32, Math.round(value)))
}

function buildMarkersParam(
  markers: Array<{ lat: number; lng: number; color?: string }>
): string {
  return markers
    .map(m => `icon-${m.color ?? 'blue'}:${m.lng},${m.lat}`)
    .join('|')
}

export const getStaticMapImageTool = tool({
  description:
    'Generate a MapTiler Static Maps URL — a single PNG snapshot of a map with optional markers. Use this when the user wants a shareable image of a location, an email/social embed, or anywhere an interactive map is not appropriate. The returned imageUrl is a public HTTPS URL that renders on fetch.',
  inputSchema: GetStaticMapImageInputSchema,
  execute: async (input): Promise<GetStaticMapImageResult> => {
    const style = input.theme === 'dark' ? 'streets-v2-dark' : 'streets-v2'
    const width = clampDimension(input.width)
    const height = clampDimension(input.height)
    const center = `${input.center.lng},${input.center.lat},${input.zoom}`

    const pathParts = [`/maps/${style}/static/${center}/${width}x${height}.png`]

    if (input.markers && input.markers.length > 0) {
      pathParts.push(`?markers=${buildMarkersParam(input.markers)}`)
    }

    try {
      const imageUrl = buildPublicMapTilerUrl(pathParts.join(''))
      return { state: 'success', imageUrl }
    } catch (error) {
      if (error instanceof MapTilerConfigError) {
        return { state: 'error', message: error.message }
      }
      throw error
    }
  }
})
