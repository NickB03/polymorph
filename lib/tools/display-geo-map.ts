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
    color: z
      .string()
      .optional()
      .describe(
        'Fill color — use for category color coding across many markers (e.g., green for open, red for closed).'
      ),
    borderColor: z.string().optional(),
    radius: z.number().min(3).max(16).optional()
  }),
  z.object({
    type: z.literal('emoji'),
    value: z
      .string()
      .min(1)
      .describe(
        'Emoji character to use as the marker icon — pick one that visually encodes the category (🏛️ museums, 🍣 sushi, ⛰️ peaks, 🏨 hotels).'
      ),
    size: z.number().min(16).max(40).optional(),
    bgColor: z.string().optional(),
    borderColor: z.string().optional()
  }),
  z.object({
    type: z.literal('image'),
    url: HttpUrlSchema.describe(
      'HTTPS URL of an image — use for brand logos, portraits, or custom iconography. Avoid large images; keep under 128px.'
    ),
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
  label: z
    .string()
    .optional()
    .describe('Short name shown in tooltip and popup — keep under 40 chars.'),
  description: z
    .string()
    .optional()
    .describe(
      'Popup body — one or two sentences providing the fact the user actually wants (address, distance, key attribute). Populate whenever the marker has real information worth reading.'
    ),
  tooltip: z
    .enum(['none', 'hover', 'always'])
    .optional()
    .describe(
      "'hover' (default) shows the label on mouse-over. 'always' forces the label to render permanently — use for overview maps where reading all labels without interaction is the point. 'none' hides it entirely."
    ),
  icon: GeoMapMarkerIconSchema.optional().describe(
    'Custom marker icon. Omit for a default blue dot. Reach for emoji icons to encode category on heterogeneous point sets.'
  )
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
  color: z
    .string()
    .optional()
    .describe(
      'Hex or named stroke color. Use warm colors (#EF4444, #F97316) for physical or current routes; cool colors (#2563EB, #0EA5E9) for planned or historical routes.'
    ),
  weight: z
    .number()
    .min(1)
    .max(12)
    .optional()
    .describe(
      'Stroke width in pixels. 3 is default. Thicker weights emphasize importance.'
    ),
  opacity: z.number().min(0).max(1).optional(),
  dashArray: z
    .string()
    .optional()
    .describe(
      "SVG dashArray string (e.g. '6,4' for short dashes, '10,6,2,6' for dash-dot). Use dashed lines for conceptual or historical routes; solid for physical routes."
    )
})

const GeoMapPolygonSchema = z.object({
  id: z.string().min(1).optional(),
  points: z
    .array(GeoMapRoutePointSchema)
    .min(3)
    .describe(
      'Ordered lat/lng vertices of the polygon ring (at least three points). Do not repeat the first point — the ring closes automatically.'
    ),
  label: z.string().optional(),
  description: z.string().optional(),
  tooltip: z.enum(['none', 'hover', 'always']).optional(),
  fillColor: z.string().optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  borderColor: z.string().optional(),
  borderOpacity: z.number().min(0).max(1).optional(),
  borderWeight: z.number().min(0).max(12).optional(),
  borderDashArray: z.string().optional()
})

const GeoMapClusteringSchema = z.object({
  enabled: z
    .boolean()
    .optional()
    .describe(
      'Enable automatic marker clustering. Turn ON whenever you are rendering >20 markers in a small region — prevents overlapping pins and reveals density at a glance.'
    ),
  radius: z.number().min(20).max(120).optional(),
  maxZoom: z.number().min(1).max(22).optional(),
  minPoints: z.number().min(2).max(20).optional()
})

const GeoMapViewportSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('fit'),
    padding: z.number().nonnegative().optional(),
    maxZoom: z.number().min(1).max(22).optional(),
    target: z
      .enum(['markers', 'routes', 'all'])
      .optional()
      .describe(
        "Which shapes should be inside the frame. 'all' (default) fits markers+routes+polygons. 'routes' is useful for journey maps where marker endpoints are much less interesting than the route itself. 'markers' ignores routes/polygons when they are context-only."
      )
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
    polygons: z
      .array(GeoMapPolygonSchema)
      .optional()
      .describe(
        'Optional filled polygons — isochrones, regions, city boundaries, etc.'
      ),
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

    const seenPolygonIds = new Set<string>()
    value.polygons?.forEach((polygon, index) => {
      if (!polygon.id) return
      if (seenPolygonIds.has(polygon.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['polygons', index, 'id'],
          message: `Duplicate polygon id "${polygon.id}".`
        })
        return
      }
      seenPolygonIds.add(polygon.id)
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
