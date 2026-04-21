import { tool } from 'ai'
import { z } from 'zod'

const LatitudeSchema = z.number().finite().min(-90).max(90)
const LongitudeSchema = z.number().finite().min(-180).max(180)
const HttpUrlSchema = z
  .string()
  .url()
  .refine(value => /^https?:\/\//i.test(value), {
    message: 'Expected an http or https URL.'
  })

const GeoMapMarkerIconSchema = z.union([
  z.object({
    type: z.literal('dot'),
    color: z.string().optional(),
    borderColor: z.string().optional(),
    radius: z.number().min(3).max(16).optional()
  }),
  z.object({
    type: z.literal('emoji'),
    value: z.string().min(1),
    size: z.number().min(16).max(40).optional(),
    bgColor: z.string().optional(),
    borderColor: z.string().optional()
  }),
  z.object({
    type: z.literal('image'),
    url: HttpUrlSchema,
    width: z.number().min(16).max(64).optional(),
    height: z.number().min(16).max(64).optional(),
    borderRadius: z.number().min(0).max(999).optional(),
    borderColor: z.string().optional()
  })
])

const GeoMapMarkerSchema = z.object({
  id: z.string().min(1).optional().describe('Stable marker id (optional)'),
  lat: LatitudeSchema.describe('Latitude in degrees'),
  lng: LongitudeSchema.describe('Longitude in degrees'),
  label: z.string().optional().describe('Accessible marker label'),
  description: z.string().optional().describe('Popup body text'),
  tooltip: z.enum(['none', 'hover', 'always']).optional(),
  icon: GeoMapMarkerIconSchema.optional()
})

const GeoMapRoutePointSchema = z.object({
  lat: LatitudeSchema,
  lng: LongitudeSchema
})

const GeoMapRouteSchema = z.object({
  id: z.string().min(1).optional(),
  points: z
    .array(GeoMapRoutePointSchema)
    .min(2)
    .describe('Ordered lat/lng waypoints (at least two)'),
  label: z.string().optional(),
  description: z.string().optional(),
  tooltip: z.enum(['none', 'hover', 'always']).optional(),
  color: z.string().optional(),
  weight: z.number().min(1).max(12).optional(),
  opacity: z.number().min(0).max(1).optional(),
  dashArray: z.string().optional()
})

const GeoMapClusteringSchema = z.object({
  enabled: z.boolean().optional(),
  radius: z.number().min(20).max(120).optional(),
  maxZoom: z.number().min(1).max(22).optional(),
  minPoints: z.number().min(2).max(20).optional()
})

const GeoMapViewportSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('fit'),
    padding: z.number().nonnegative().optional(),
    maxZoom: z.number().min(1).max(22).optional(),
    target: z.enum(['markers', 'routes', 'all']).optional()
  }),
  z.object({
    mode: z.literal('center'),
    center: z.object({ lat: LatitudeSchema, lng: LongitudeSchema }),
    zoom: z.number().min(1).max(22)
  })
])

export const DisplayGeoMapSchema = z
  .object({
    id: z.string().min(1).describe('Unique identifier for this map instance'),
    title: z.string().optional().describe('Accessible region label'),
    description: z.string().optional(),
    markers: z
      .array(GeoMapMarkerSchema)
      .min(1)
      .describe('One or more geographic markers to render'),
    routes: z
      .array(GeoMapRouteSchema)
      .optional()
      .describe('Optional polylines connecting waypoints'),
    clustering: GeoMapClusteringSchema.optional(),
    viewport: GeoMapViewportSchema.optional(),
    showZoomControl: z.boolean().optional(),
    theme: z.enum(['light', 'dark']).optional()
  })
  .superRefine((value, ctx) => {
    const seenMarkerIds = new Set<string>()
    value.markers.forEach((marker, index) => {
      if (!marker.id) return
      if (seenMarkerIds.has(marker.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['markers', index, 'id'],
          message: `Duplicate marker id "${marker.id}".`
        })
        return
      }
      seenMarkerIds.add(marker.id)
    })

    const seenRouteIds = new Set<string>()
    value.routes?.forEach((route, index) => {
      if (!route.id) return
      if (seenRouteIds.has(route.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['routes', index, 'id'],
          message: `Duplicate route id "${route.id}".`
        })
        return
      }
      seenRouteIds.add(route.id)
    })
  })

export const displayGeoMapTool = tool({
  description:
    'Display geographic points, routes, and regions on an interactive map. ' +
    'Use when the user asks to visualize locations, compare places, plot ' +
    'routes, or explore an area. Prefer `viewport.mode="fit"` unless the ' +
    'user specified a center and zoom level.',
  inputSchema: DisplayGeoMapSchema,
  execute: async params => params
})
