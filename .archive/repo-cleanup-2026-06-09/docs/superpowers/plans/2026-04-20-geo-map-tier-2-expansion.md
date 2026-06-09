# Geo-Map Tier 2 Expansion Implementation Plan

> **Status:** Completed historical plan. Geo Tier 2 tools are already part of the current chat-agent toolset; source paths below predate the `lib/agents/chat/*` module split and should not be used as fresh execution instructions.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new MapTiler-backed tools (`getDirections`, `geocodeAddress`, `getIsochrone`, `getStaticMapImage`) plus a polygon render primitive on the existing geo-map; additively expand the researcher's prompt so the agent actually uses the Tier 1 capabilities of `displayGeoMap` (clustering, emoji/image icons, always-on tooltips, marker descriptions, route styling) and composes the new tools correctly.

**Architecture:**

- Each new tool lives at `lib/tools/<name>.ts` as a thin `tool()` wrapper around one HTTP endpoint. Shared concerns (API key loading, fetch with error handling, URL construction) go in a new `lib/tools/maptiler/client.ts` module — DRY principle for the three tools that call MapTiler.
- **Two-key MapTiler setup.** `NEXT_PUBLIC_MAPTILER_API_KEY` stays in the client bundle for Leaflet tile loads (domain-locked via MapTiler dashboard). A separate server-only `MAPTILER_API_KEY` is used by the three server-side tools (directions, geocoding, static maps). `lib/tools/maptiler/client.ts` reads `MAPTILER_API_KEY ?? NEXT_PUBLIC_MAPTILER_API_KEY` so it prefers the private key but gracefully falls back — this means deployments with only the public key still work, while deployments with both get defense-in-depth.
- `getDirections` accepts `driving | walking | cycling | transit`. MapTiler's underlying OSRM engine supports the first three natively. `transit` returns a structured `NOT_SUPPORTED` result — real transit routing requires integrating a separate provider (OpenTripPlanner, Google Directions API) and is explicitly out of scope. The prompt teaches the agent to fall back gracefully when it sees `NOT_SUPPORTED`.
- `getIsochrone` uses **openrouteservice.org** because MapTiler does not publish an isochrones endpoint. This introduces a second provider and a new server-only `ORS_API_KEY` env var. This task can be skipped without affecting the other three tools.
- A `polygons[]` array is added to `GeoMapPropsSchema` and rendered via react-leaflet's `Polygon`. This is required for isochrones (which return polygon geometry), and future features like city boundaries or wine regions. The schema addition is fully optional — existing `displayGeoMap` calls that don't pass polygons continue to work unchanged.
- Prompt updates are **additive only**: both `RESEARCH_MODE_PROMPT` and `CHAT_MODE_PROMPT` blocks get new bullets appended. Existing bullets stay verbatim. Duplicated blocks are NOT consolidated — consolidation is a shape change, not additive, and deferred.

**Tech Stack:** AI SDK v5 `tool()`, Zod, MapTiler Directions v1 (OSRM-compatible), MapTiler Geocoding v5, MapTiler Static Maps, OpenRouteService Isochrones v2 (optional), react-leaflet `Polygon`, Vitest.

**Out of scope (explicit non-goals):**

- Real public transit routing (stubbed with structured fallback — documented for follow-up)
- Heatmaps, animated markers, time-based playback (Tier 3)
- MapTiler Places / POI search (Tier 3)
- Consolidating duplicated prompt blocks (deferred — user requested additive only)
- Removing or changing existing Tier 1 behavior

---

## File Structure

**New files:**

| Path                                               | Responsibility                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `lib/tools/maptiler/client.ts`                     | Shared MapTiler HTTP helper (API key, URL builder, typed fetch, error classes) |
| `lib/tools/maptiler/__tests__/client.test.ts`      | Unit tests for the client                                                      |
| `lib/tools/get-directions.ts`                      | MapTiler Directions API wrapper with multi-profile support + transit stub      |
| `lib/tools/__tests__/get-directions.test.ts`       | Unit tests                                                                     |
| `lib/tools/geocode-address.ts`                     | MapTiler Geocoding v5 API wrapper                                              |
| `lib/tools/__tests__/geocode-address.test.ts`      | Unit tests                                                                     |
| `lib/tools/get-isochrone.ts`                       | OpenRouteService isochrones wrapper (optional task)                            |
| `lib/tools/__tests__/get-isochrone.test.ts`        | Unit tests                                                                     |
| `lib/tools/get-static-map-image.ts`                | MapTiler Static Maps URL builder (no network call in `execute`)                |
| `lib/tools/__tests__/get-static-map-image.test.ts` | Unit tests                                                                     |

**Modified files:**

| Path                                                         | Change                                                                                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/tool-ui/geo-map/schema.ts`                       | Add `GeoMapPolygonSchema`; extend `GeoMapPropsSchema` with optional `polygons?: GeoMapPolygon[]`                                                            |
| `components/tool-ui/geo-map/geo-map-engine.tsx`              | Import `Polygon` from react-leaflet; render `polygons` array                                                                                                |
| `components/tool-ui/geo-map/_adapter.tsx`                    | Re-export `Polygon` from react-leaflet alongside existing exports                                                                                           |
| `components/tool-ui/geo-map/__tests__/schema.test.ts`        | Add polygon validation cases                                                                                                                                |
| `components/tool-ui/geo-map/__tests__/schema-mirror.test.ts` | Add polygon parity fixture                                                                                                                                  |
| `lib/tools/display-geo-map.ts`                               | Mirror polygon schema; add `.describe()` annotations to non-obvious fields                                                                                  |
| `lib/tools/__tests__/display-geo-map.test.ts`                | Add polygon schema validation test                                                                                                                          |
| `lib/agents/researcher.ts`                                   | Import + register 4 new tools in both chat & research mode tool lists                                                                                       |
| `lib/types/agent.ts`                                         | Extend `ResearcherTools` type + export new UIToolInvocation types                                                                                           |
| `lib/agents/prompts/search-mode-prompts.ts`                  | Additive expansion of displayGeoMap block + new blocks for the 4 new tools (duplicate changes in both `RESEARCH_MODE_PROMPT` and `CHAT_MODE_PROMPT` copies) |
| `.env.local.example`                                         | Document `ORS_API_KEY` if Task 4 implemented                                                                                                                |
| `docs/getting-started/ENVIRONMENT.md`                        | Add `ORS_API_KEY` row if Task 4 implemented                                                                                                                 |

---

## Task 1: MapTiler shared HTTP client

**Files:**

- Create: `lib/tools/maptiler/client.ts`
- Create: `lib/tools/maptiler/__tests__/client.test.ts`

One place for URL construction, API-key lookup, typed fetch, and error normalization. The directions, geocoding, and static-map tools all depend on this.

- [ ] **Step 1.1: Write the failing test**

Create `lib/tools/maptiler/__tests__/client.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const originalEnv = { ...process.env }

async function importFresh() {
  vi.resetModules()
  return import('../client')
}

describe('maptiler client', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  it('builds a URL with api key from NEXT_PUBLIC_MAPTILER_API_KEY', async () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key'
    const { buildMapTilerUrl } = await importFresh()
    expect(buildMapTilerUrl('/geocoding/Paris.json')).toBe(
      'https://api.maptiler.com/geocoding/Paris.json?key=test-key'
    )
  })

  it('prefers server-only MAPTILER_API_KEY when both are set', async () => {
    process.env.MAPTILER_API_KEY = 'server-key'
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'public-key'
    const { buildMapTilerUrl } = await importFresh()
    expect(buildMapTilerUrl('/x')).toBe(
      'https://api.maptiler.com/x?key=server-key'
    )
  })

  it('falls back to NEXT_PUBLIC_MAPTILER_API_KEY when server key is unset', async () => {
    delete process.env.MAPTILER_API_KEY
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'public-only'
    const { buildMapTilerUrl } = await importFresh()
    expect(buildMapTilerUrl('/x')).toBe(
      'https://api.maptiler.com/x?key=public-only'
    )
  })

  it('preserves existing query params when key is appended', async () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'k'
    const { buildMapTilerUrl } = await importFresh()
    expect(
      buildMapTilerUrl('/directions/v1/driving/1,1;2,2?geometries=geojson')
    ).toBe(
      'https://api.maptiler.com/directions/v1/driving/1,1;2,2?geometries=geojson&key=k'
    )
  })

  it('throws MapTilerConfigError when both keys are missing', async () => {
    delete process.env.MAPTILER_API_KEY
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY
    const { buildMapTilerUrl, MapTilerConfigError } = await importFresh()
    expect(() => buildMapTilerUrl('/x')).toThrow(MapTilerConfigError)
  })

  it('fetchMapTilerJson returns parsed JSON on 200', async () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'k'
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ hello: 'world' })
    })
    const { fetchMapTilerJson } = await importFresh()
    const result = await fetchMapTilerJson('/x')
    expect(result).toEqual({ hello: 'world' })
  })

  it('fetchMapTilerJson throws MapTilerApiError on non-200', async () => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'k'
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('forbidden')
    })
    const { fetchMapTilerJson, MapTilerApiError } = await importFresh()
    await expect(fetchMapTilerJson('/x')).rejects.toThrow(MapTilerApiError)
  })
})
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `bun run test -- lib/tools/maptiler/__tests__/client.test.ts`
Expected: FAIL with `Cannot find module '../client'`.

- [ ] **Step 1.3: Implement the client module**

Create `lib/tools/maptiler/client.ts`:

```typescript
const MAPTILER_BASE_URL = 'https://api.maptiler.com'

export class MapTilerConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MapTilerConfigError'
  }
}

export class MapTilerApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string) {
    super(`MapTiler API error ${status}: ${body.slice(0, 200)}`)
    this.name = 'MapTilerApiError'
    this.status = status
    this.body = body
  }
}

function getApiKey(): string {
  // Prefer the server-only key (not exposed to the browser). Fall back to the
  // public key so deployments without a dedicated server key still work.
  const key =
    process.env.MAPTILER_API_KEY ?? process.env.NEXT_PUBLIC_MAPTILER_API_KEY
  if (!key) {
    throw new MapTilerConfigError(
      'Neither MAPTILER_API_KEY nor NEXT_PUBLIC_MAPTILER_API_KEY is set. See docs/getting-started/ENVIRONMENT.md.'
    )
  }
  return key
}

export function buildMapTilerUrl(path: string): string {
  const key = getApiKey()
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = `${MAPTILER_BASE_URL}${normalized}`
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}key=${key}`
}

export async function fetchMapTilerJson<T>(path: string): Promise<T> {
  const url = buildMapTilerUrl(path)
  const response = await fetch(url)

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new MapTilerApiError(response.status, body)
  }

  return (await response.json()) as T
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `bun run test -- lib/tools/maptiler/__tests__/client.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 1.5: Typecheck + lint**

Run: `bun typecheck && bun lint`
Expected: both exit 0.

- [ ] **Step 1.6: Update env docs with the server-only MapTiler key**

Edit `.env.local.example` — replace the existing "Map tiles" block (section 11, around line 147) with:

```
# -----------------------------------------------------------------------------
# 11. Map data
# -----------------------------------------------------------------------------
# MapTiler — tile loads in the browser (Leaflet). MUST be NEXT_PUBLIC_ so it
# reaches the client bundle. Lock this key's "allowed origins" in the MapTiler
# dashboard to production + localhost domains.
# NEXT_PUBLIC_MAPTILER_API_KEY=your_public_key_here

# MapTiler — server-only API calls (getDirections, geocodeAddress,
# getStaticMapImage). Generate a SECOND key in the MapTiler dashboard; leave
# its origin allowlist empty — server requests don't send an Origin header.
# Falls back to NEXT_PUBLIC_MAPTILER_API_KEY if unset.
# MAPTILER_API_KEY=your_server_key_here
```

Edit `docs/getting-started/ENVIRONMENT.md` — replace the existing "Map tiles (geo-map Tool UI)" section's single row with two rows:

```markdown
| Variable                       | Required    | Purpose                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MAPTILER_API_KEY` | Recommended | **Client-side MapTiler key** for `streets-v2` (light) and `streets-v2-dark` basemaps — reaches the browser. Lock this key's "allowed origins" in the MapTiler dashboard to production + localhost. Free tier: 100K tile loads/month, commercial use permitted. When unset, the map falls back to CARTO Voyager (light only).                          |
| `MAPTILER_API_KEY`             | Recommended | **Server-only MapTiler key** for `getDirections`, `geocodeAddress`, `getStaticMapImage` tools. Generate a second key in the MapTiler dashboard with no origin restriction. When unset, server tools fall back to `NEXT_PUBLIC_MAPTILER_API_KEY`, but keeping a separate server-only key gives defense in depth if the public key's origin-lock fails. |
```

- [ ] **Step 1.7: Commit**

```bash
git add lib/tools/maptiler/ .env.local.example docs/getting-started/ENVIRONMENT.md
git commit -m "feat(tools): add shared MapTiler HTTP client with server-key fallback"
```

---

## Task 2: `getDirections` tool

**Files:**

- Create: `lib/tools/get-directions.ts`
- Create: `lib/tools/__tests__/get-directions.test.ts`

Accepts origin, destination, optional waypoints, and profile (`driving | walking | cycling | transit`). Returns a structured result with real road-following geometry plus duration/distance, or a `NOT_SUPPORTED` result for transit.

- [ ] **Step 2.1: Write the failing test**

Create `lib/tools/__tests__/get-directions.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const originalEnv = { ...process.env }

async function importFresh() {
  vi.resetModules()
  return import('../get-directions')
}

async function execute(params: unknown) {
  const { getDirectionsTool } = await importFresh()
  const executeFn = getDirectionsTool.execute
  if (!executeFn) throw new Error('no execute')
  return executeFn(
    params as never,
    {
      toolCallId: 'test',
      messages: []
    } as never
  )
}

describe('getDirectionsTool', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  it('returns a driving route with geometry and labels', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          routes: [
            {
              duration: 3456,
              distance: 45123,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-118.4, 33.94],
                  [-118.3, 34.0],
                  [-118.24, 34.05]
                ]
              }
            }
          ]
        })
    })

    const result = await execute({
      origin: { lat: 33.94, lng: -118.4 },
      destination: { lat: 34.05, lng: -118.24 },
      profile: 'driving'
    })

    expect(result).toEqual({
      state: 'success',
      profile: 'driving',
      duration: 3456,
      distance: 45123,
      durationLabel: '58 min',
      distanceLabel: '28.0 mi',
      points: [
        { lat: 33.94, lng: -118.4 },
        { lat: 34.0, lng: -118.3 },
        { lat: 34.05, lng: -118.24 }
      ]
    })
  })

  it('calls MapTiler with driving profile and correct coord order', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          routes: [
            {
              duration: 10,
              distance: 100,
              geometry: { type: 'LineString', coordinates: [[0, 0]] }
            }
          ]
        })
    })

    await execute({
      origin: { lat: 10, lng: 20 },
      destination: { lat: 30, lng: 40 },
      profile: 'driving'
    })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/directions/v1/driving/')
    expect(calledUrl).toContain('20,10;40,30')
    expect(calledUrl).toContain('geometries=geojson')
    expect(calledUrl).toContain('key=test-key')
  })

  it('includes waypoints in the URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          routes: [
            {
              duration: 1,
              distance: 1,
              geometry: { type: 'LineString', coordinates: [[0, 0]] }
            }
          ]
        })
    })

    await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 2, lng: 2 },
      waypoints: [{ lat: 1, lng: 1 }],
      profile: 'walking'
    })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/directions/v1/walking/')
    expect(calledUrl).toContain('0,0;1,1;2,2')
  })

  it('returns NOT_SUPPORTED for transit profile without calling MapTiler', async () => {
    const result = await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      profile: 'transit'
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      state: 'not_supported',
      profile: 'transit'
    })
    expect((result as { message: string }).message).toMatch(/transit/i)
  })

  it('returns error state when MapTiler returns 403', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden')
    })

    const result = await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      profile: 'driving'
    })

    expect(result).toMatchObject({ state: 'error' })
  })

  it('returns error state when MapTiler returns no routes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ routes: [] })
    })

    const result = await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      profile: 'driving'
    })

    expect(result).toMatchObject({ state: 'error' })
  })

  it('formats duration labels below 60 seconds as seconds', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          routes: [
            {
              duration: 45,
              distance: 50,
              geometry: { type: 'LineString', coordinates: [[0, 0]] }
            }
          ]
        })
    })

    const result = await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      profile: 'walking'
    })

    expect((result as { durationLabel: string }).durationLabel).toBe('45 sec')
  })

  it('formats distance labels below 0.1 mi as feet', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          routes: [
            {
              duration: 60,
              distance: 50,
              geometry: { type: 'LineString', coordinates: [[0, 0]] }
            }
          ]
        })
    })

    const result = await execute({
      origin: { lat: 0, lng: 0 },
      destination: { lat: 1, lng: 1 },
      profile: 'walking'
    })

    expect((result as { distanceLabel: string }).distanceLabel).toBe('164 ft')
  })
})
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `bun run test -- lib/tools/__tests__/get-directions.test.ts`
Expected: FAIL with `Cannot find module '../get-directions'`.

- [ ] **Step 2.3: Implement the tool**

Create `lib/tools/get-directions.ts`:

```typescript
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
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
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
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `bun run test -- lib/tools/__tests__/get-directions.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 2.5: Typecheck + lint**

Run: `bun typecheck && bun lint`
Expected: both exit 0.

- [ ] **Step 2.6: Commit**

```bash
git add lib/tools/get-directions.ts lib/tools/__tests__/get-directions.test.ts
git commit -m "feat(tools): add getDirections with driving/walking/cycling support"
```

---

## Task 3: `geocodeAddress` tool

**Files:**

- Create: `lib/tools/geocode-address.ts`
- Create: `lib/tools/__tests__/geocode-address.test.ts`

Resolves an address string (e.g. "2450 Mission St, San Francisco") to precise lat/lng via MapTiler Geocoding v5. Returns up to N results with formatted place names.

- [ ] **Step 3.1: Write the failing test**

Create `lib/tools/__tests__/geocode-address.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const originalEnv = { ...process.env }

async function importFresh() {
  vi.resetModules()
  return import('../geocode-address')
}

async function execute(params: unknown) {
  const { geocodeAddressTool } = await importFresh()
  const executeFn = geocodeAddressTool.execute
  if (!executeFn) throw new Error('no execute')
  return executeFn(
    params as never,
    {
      toolCallId: 'test',
      messages: []
    } as never
  )
}

describe('geocodeAddressTool', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  it('returns lat/lng and formatted place name for a match', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              place_name_en: 'Eiffel Tower, Paris, France',
              center: [2.2945, 48.8584],
              place_type: ['poi']
            }
          ]
        })
    })

    const result = await execute({ query: 'Eiffel Tower' })

    expect(result).toEqual({
      state: 'success',
      results: [
        {
          lat: 48.8584,
          lng: 2.2945,
          placeName: 'Eiffel Tower, Paris, France',
          placeType: 'poi'
        }
      ]
    })
  })

  it('URL-encodes the query and respects limit', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              place_name_en: 'A',
              center: [0, 0],
              place_type: ['address']
            }
          ]
        })
    })

    await execute({ query: 'café w/ space & comma', limit: 3 })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/geocoding/')
    expect(calledUrl).toContain(encodeURIComponent('café w/ space & comma'))
    expect(calledUrl).toContain('limit=3')
  })

  it('returns not_found when features is empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ features: [] })
    })

    const result = await execute({ query: 'zzznowhere' })

    expect(result).toMatchObject({
      state: 'not_found',
      query: 'zzznowhere'
    })
  })

  it('falls back to place_name when place_name_en is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              place_name: 'Somewhere',
              center: [1, 2],
              place_type: ['region']
            }
          ]
        })
    })

    const result = await execute({ query: 'x' })
    expect(
      (
        result as {
          results: Array<{ placeName: string }>
        }
      ).results[0].placeName
    ).toBe('Somewhere')
  })

  it('returns error on api failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('boom')
    })

    const result = await execute({ query: 'x' })
    expect(result).toMatchObject({ state: 'error' })
  })
})
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `bun run test -- lib/tools/__tests__/geocode-address.test.ts`
Expected: FAIL with `Cannot find module '../geocode-address'`.

- [ ] **Step 3.3: Implement the tool**

Create `lib/tools/geocode-address.ts`:

```typescript
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
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `bun run test -- lib/tools/__tests__/geocode-address.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 3.5: Typecheck + lint**

Run: `bun typecheck && bun lint`

- [ ] **Step 3.6: Commit**

```bash
git add lib/tools/geocode-address.ts lib/tools/__tests__/geocode-address.test.ts
git commit -m "feat(tools): add geocodeAddress tool for place → coords resolution"
```

---

## Task 4: `getIsochrone` tool (optional — introduces ORS dependency)

**Files:**

- Create: `lib/tools/get-isochrone.ts`
- Create: `lib/tools/__tests__/get-isochrone.test.ts`

Returns a polygon representing the area reachable within N minutes from a center point. Uses OpenRouteService (ORS) because MapTiler does not publish an isochrones endpoint.

**⚠️ This task can be skipped.** If skipped: don't update `ResearcherTools`/researcher/prompts with isochrone references in later tasks; don't add the env var. The other three tools work independently.

**Dependency:** Requires a free ORS API key from https://openrouteservice.org/dev/#/signup. Add to `.env.local`:

```
ORS_API_KEY=your_key_here
```

- [ ] **Step 4.1: Write the failing test**

Create `lib/tools/__tests__/get-isochrone.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const originalEnv = { ...process.env }

async function importFresh() {
  vi.resetModules()
  return import('../get-isochrone')
}

async function execute(params: unknown) {
  const { getIsochroneTool } = await importFresh()
  const executeFn = getIsochroneTool.execute
  if (!executeFn) throw new Error('no execute')
  return executeFn(
    params as never,
    {
      toolCallId: 'test',
      messages: []
    } as never
  )
}

describe('getIsochroneTool', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env = { ...originalEnv }
    process.env.ORS_API_KEY = 'ors-test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  it('returns a polygon for a successful isochrone request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [-122.4, 37.7],
                    [-122.3, 37.8],
                    [-122.2, 37.7],
                    [-122.4, 37.7]
                  ]
                ]
              }
            }
          ]
        })
    })

    const result = await execute({
      center: { lat: 37.75, lng: -122.3 },
      durationMinutes: 30,
      profile: 'driving'
    })

    expect(result).toEqual({
      state: 'success',
      profile: 'driving',
      durationMinutes: 30,
      points: [
        { lat: 37.7, lng: -122.4 },
        { lat: 37.8, lng: -122.3 },
        { lat: 37.7, lng: -122.2 }
      ]
    })
  })

  it('calls ORS with driving-car profile and duration in seconds', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              geometry: {
                type: 'Polygon',
                coordinates: [[[0, 0]]]
              }
            }
          ]
        })
    })

    await execute({
      center: { lat: 0, lng: 0 },
      durationMinutes: 15,
      profile: 'driving'
    })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/v2/isochrones/driving-car')

    const calledInit = mockFetch.mock.calls[0][1] as RequestInit
    expect(calledInit.method).toBe('POST')
    expect((calledInit.headers as Record<string, string>).Authorization).toBe(
      'ors-test-key'
    )
    const body = JSON.parse(calledInit.body as string) as {
      locations: Array<[number, number]>
      range: number[]
      range_type: string
    }
    expect(body.locations).toEqual([[0, 0]])
    expect(body.range).toEqual([900])
    expect(body.range_type).toBe('time')
  })

  it('maps walking profile to foot-walking', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          features: [
            {
              geometry: {
                type: 'Polygon',
                coordinates: [[[0, 0]]]
              }
            }
          ]
        })
    })

    await execute({
      center: { lat: 0, lng: 0 },
      durationMinutes: 10,
      profile: 'walking'
    })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/v2/isochrones/foot-walking')
  })

  it('returns error when ORS_API_KEY is missing', async () => {
    delete process.env.ORS_API_KEY

    const result = await execute({
      center: { lat: 0, lng: 0 },
      durationMinutes: 10,
      profile: 'driving'
    })

    expect(result).toMatchObject({ state: 'error' })
    expect((result as { message: string }).message).toMatch(/ORS_API_KEY/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns error on non-200 response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited')
    })

    const result = await execute({
      center: { lat: 0, lng: 0 },
      durationMinutes: 10,
      profile: 'driving'
    })

    expect(result).toMatchObject({ state: 'error' })
  })
})
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `bun run test -- lib/tools/__tests__/get-isochrone.test.ts`
Expected: FAIL with `Cannot find module '../get-isochrone'`.

- [ ] **Step 4.3: Implement the tool**

Create `lib/tools/get-isochrone.ts`:

```typescript
import { tool } from 'ai'
import { z } from 'zod'

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
      const response = await fetch(url, {
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

      // ORS closes polygon rings by repeating the first point — drop the closer.
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
```

- [ ] **Step 4.4: Run test to verify it passes**

Run: `bun run test -- lib/tools/__tests__/get-isochrone.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 4.5: Typecheck + lint**

Run: `bun typecheck && bun lint`

- [ ] **Step 4.6: Update env docs**

Edit `.env.local.example` — append after the MapTiler section (around line 143):

```
# OpenRouteService API key powers isochrones (drive-time reachability polygons)
# in the getIsochrone tool. Free tier: 2500 requests/day, sign up at
# https://openrouteservice.org/dev/#/signup
# ORS_API_KEY=your_key_here
```

Edit `docs/getting-started/ENVIRONMENT.md` — add a row to the "Map tiles (geo-map Tool UI)" table:

```markdown
| `ORS_API_KEY` | Optional | OpenRouteService API key for the `getIsochrone` tool. Free tier: 2500 requests/day. Sign up at https://openrouteservice.org/dev/#/signup. When unset, `getIsochrone` returns an error result gracefully. |
```

- [ ] **Step 4.7: Commit**

```bash
git add lib/tools/get-isochrone.ts lib/tools/__tests__/get-isochrone.test.ts .env.local.example docs/getting-started/ENVIRONMENT.md
git commit -m "feat(tools): add getIsochrone via OpenRouteService"
```

---

## Task 5: `getStaticMapImage` tool

**Files:**

- Create: `lib/tools/get-static-map-image.ts`
- Create: `lib/tools/__tests__/get-static-map-image.test.ts`

Builds a MapTiler Static Maps URL. No network call in `execute` — the URL itself is the result (MapTiler renders on-the-fly when the browser or downstream consumer fetches it).

- [ ] **Step 5.1: Write the failing test**

Create `lib/tools/__tests__/get-static-map-image.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

async function importFresh() {
  vi.resetModules()
  return import('../get-static-map-image')
}

async function execute(params: unknown) {
  const { getStaticMapImageTool } = await importFresh()
  const executeFn = getStaticMapImageTool.execute
  if (!executeFn) throw new Error('no execute')
  return executeFn(
    params as never,
    {
      toolCallId: 'test',
      messages: []
    } as never
  )
}

describe('getStaticMapImageTool', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = originalEnv
  })

  it('builds a centered static map URL in light theme by default', async () => {
    const result = await execute({
      center: { lat: 37.7749, lng: -122.4194 },
      zoom: 12,
      width: 600,
      height: 400
    })

    expect(result).toEqual({
      state: 'success',
      imageUrl:
        'https://api.maptiler.com/maps/streets-v2/static/-122.4194,37.7749,12/600x400.png?key=test-key'
    })
  })

  it('uses the dark style when theme is dark', async () => {
    const result = await execute({
      center: { lat: 0, lng: 0 },
      zoom: 5,
      width: 200,
      height: 200,
      theme: 'dark'
    })

    expect((result as { imageUrl: string }).imageUrl).toContain(
      '/maps/streets-v2-dark/static/'
    )
  })

  it('appends markers when provided', async () => {
    const result = await execute({
      center: { lat: 0, lng: 0 },
      zoom: 10,
      width: 400,
      height: 300,
      markers: [
        { lat: 1.23, lng: 4.56, color: 'red' },
        { lat: -2.1, lng: 3.4 }
      ]
    })

    const imageUrl = (result as { imageUrl: string }).imageUrl
    expect(imageUrl).toContain('markers=')
    expect(imageUrl).toContain('icon-red:4.56,1.23')
    expect(imageUrl).toContain('icon-blue:3.4,-2.1')
  })

  it('returns error when api key is missing', async () => {
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY

    const result = await execute({
      center: { lat: 0, lng: 0 },
      zoom: 10,
      width: 100,
      height: 100
    })

    expect(result).toMatchObject({ state: 'error' })
  })

  it('clamps width and height to MapTiler max (2048)', async () => {
    const result = await execute({
      center: { lat: 0, lng: 0 },
      zoom: 10,
      width: 5000,
      height: 5000
    })

    const imageUrl = (result as { imageUrl: string }).imageUrl
    expect(imageUrl).toContain('2048x2048.png')
  })
})
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `bun run test -- lib/tools/__tests__/get-static-map-image.test.ts`
Expected: FAIL with `Cannot find module '../get-static-map-image'`.

- [ ] **Step 5.3: Implement the tool**

Create `lib/tools/get-static-map-image.ts`:

```typescript
import { tool } from 'ai'
import { z } from 'zod'

import { buildMapTilerUrl, MapTilerConfigError } from './maptiler/client'

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
    .describe('Image width in pixels (max 2048).'),
  height: z
    .number()
    .int()
    .min(32)
    .max(MAX_DIMENSION)
    .describe('Image height in pixels (max 2048).'),
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
      pathParts.push(
        `?markers=${encodeURIComponent(buildMarkersParam(input.markers))}`
      )
    }

    try {
      const imageUrl = buildMapTilerUrl(pathParts.join(''))
      return { state: 'success', imageUrl }
    } catch (error) {
      if (error instanceof MapTilerConfigError) {
        return { state: 'error', message: error.message }
      }
      throw error
    }
  }
})
```

- [ ] **Step 5.4: Run test to verify it passes**

Run: `bun run test -- lib/tools/__tests__/get-static-map-image.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5.5: Typecheck + lint**

Run: `bun typecheck && bun lint`

- [ ] **Step 5.6: Commit**

```bash
git add lib/tools/get-static-map-image.ts lib/tools/__tests__/get-static-map-image.test.ts
git commit -m "feat(tools): add getStaticMapImage URL builder"
```

---

## Task 6: Polygon schema (both files + mirror parity)

**Files:**

- Modify: `components/tool-ui/geo-map/schema.ts`
- Modify: `lib/tools/display-geo-map.ts`
- Modify: `components/tool-ui/geo-map/__tests__/schema.test.ts`
- Modify: `components/tool-ui/geo-map/__tests__/schema-mirror.test.ts`

Adds `polygons?: GeoMapPolygon[]` as an optional field on `GeoMapPropsSchema`. Existing calls are unaffected. Both mirror copies must be updated in lockstep or `schema-mirror.test.ts` fails.

- [ ] **Step 6.1: Write the failing parity test fixture**

Open `components/tool-ui/geo-map/__tests__/schema-mirror.test.ts`. Inside the `parityCases` array (around line 7 — you already read it), append a new case before the closing `]`:

```typescript
  {
    name: 'polygon',
    expected: true,
    payload: {
      id: 'polygon',
      markers: [{ id: 'center', lat: 37.75, lng: -122.3 }],
      polygons: [
        {
          id: 'iso-30',
          points: [
            { lat: 37.7, lng: -122.4 },
            { lat: 37.8, lng: -122.3 },
            { lat: 37.7, lng: -122.2 }
          ],
          label: '30-minute drive',
          fillColor: '#2563EB',
          fillOpacity: 0.2,
          borderColor: '#2563EB',
          borderWeight: 2
        }
      ]
    }
  }
```

- [ ] **Step 6.2: Run mirror test — confirm it fails**

Run: `bun run test -- components/tool-ui/geo-map/__tests__/schema-mirror.test.ts`
Expected: FAIL on the new 'polygon' case because the schemas reject `polygons` as unknown.

- [ ] **Step 6.3: Add `GeoMapPolygonSchema` to `components/tool-ui/geo-map/schema.ts`**

Insert after `GeoMapRouteSchema` (around line 80):

```typescript
export const GeoMapPolygonSchema = z.object({
  id: z.string().min(1).optional(),
  points: z.array(GeoMapRoutePointSchema).min(3),
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

export type GeoMapPolygon = z.infer<typeof GeoMapPolygonSchema>
```

Extend `GeoMapPropsSchema` inside the `.object({...})` block — add this field after `routes`:

```typescript
    polygons: z.array(GeoMapPolygonSchema).optional(),
```

Extend the `.superRefine` duplicate-id check — add after the routes dedup loop:

```typescript
const seenPolygonIds = new Set<string>()
value.polygons?.forEach((polygon, index) => {
  if (!polygon.id) {
    return
  }
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
```

- [ ] **Step 6.4: Mirror into `lib/tools/display-geo-map.ts`**

Insert after `GeoMapRouteSchema` (around line 66):

```typescript
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
```

In `DisplayGeoMapSchema` add (after `routes`):

```typescript
    polygons: z
      .array(GeoMapPolygonSchema)
      .optional()
      .describe(
        'Optional filled polygons — isochrones, regions, city boundaries, etc.'
      ),
```

In the `.superRefine`, add the same polygon-id dedup loop shown in Step 6.3.

- [ ] **Step 6.5: Run mirror test — confirm it passes**

Run: `bun run test -- components/tool-ui/geo-map/__tests__/schema-mirror.test.ts`
Expected: PASS.

- [ ] **Step 6.6: Add polygon unit tests to schema.test.ts**

Open `components/tool-ui/geo-map/__tests__/schema.test.ts` and append inside the existing `describe` block:

```typescript
it('accepts valid polygons', () => {
  const result = safeParseSerializableGeoMap({
    id: 'iso',
    markers: [{ lat: 0, lng: 0 }],
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
    id: 'iso',
    markers: [{ lat: 0, lng: 0 }],
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
    id: 'iso',
    markers: [{ lat: 0, lng: 0 }],
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
```

- [ ] **Step 6.7: Run all geo-map schema tests**

Run: `bun run test -- components/tool-ui/geo-map/__tests__`
Expected: all pass (schema + mirror).

- [ ] **Step 6.8: Typecheck + lint**

Run: `bun typecheck && bun lint`

- [ ] **Step 6.9: Commit**

```bash
git add components/tool-ui/geo-map/schema.ts components/tool-ui/geo-map/__tests__/schema.test.ts components/tool-ui/geo-map/__tests__/schema-mirror.test.ts lib/tools/display-geo-map.ts
git commit -m "feat(geo-map): add polygon primitive to schema + mirror"
```

---

## Task 7: Render polygons in the Leaflet engine

**Files:**

- Modify: `components/tool-ui/geo-map/_adapter.tsx`
- Modify: `components/tool-ui/geo-map/geo-map-engine.tsx`

Polygons render as filled Leaflet `Polygon` shapes with optional hover/click tooltip and popup (reusing `GeoMapOverlays` like markers and routes do). The viewport controller should treat polygon points as first-class fit targets alongside markers and routes.

- [ ] **Step 7.1: Re-export `Polygon` from the adapter**

Open `components/tool-ui/geo-map/_adapter.tsx`. Find the existing react-leaflet re-exports and add `Polygon`. Example (exact shape depends on how the file is structured — match the existing pattern):

```typescript
export {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl
} from 'react-leaflet'
```

- [ ] **Step 7.2: Accept `polygons` prop in the engine**

Open `components/tool-ui/geo-map/geo-map-engine.tsx`. Add `Polygon` to the `./_adapter` import. Add `GeoMapPolygon` to the `./schema` type import. Extend the component's prop type and destructure:

```typescript
import type {
  GeoMapClustering,
  GeoMapFitTarget,
  GeoMapMarker,
  GeoMapPolygon,
  GeoMapRoute,
  GeoMapViewport
} from './schema'
```

In the engine's props type (around line 396), add:

```typescript
  polygons?: GeoMapPolygon[]
```

In the destructure:

```typescript
  polygons,
```

Add `const resolvedPolygons = polygons ?? EMPTY_POLYGONS` (define `EMPTY_POLYGONS` near the existing `EMPTY_ROUTES` constant).

- [ ] **Step 7.3: Extend `collectFitPoints` to include polygon vertices**

Modify `collectFitPoints` signature and body:

```typescript
export function collectFitPoints(
  markers: GeoMapMarker[],
  routes: GeoMapRoute[],
  polygons: GeoMapPolygon[],
  target: GeoMapFitTarget
): GeoMapLatLng[] {
  const markerPoints =
    target === 'markers' || target === 'all'
      ? markers.map(marker => [marker.lat, marker.lng] as GeoMapLatLng)
      : []

  const routePoints =
    target === 'routes' || target === 'all'
      ? routes.flatMap(route =>
          route.points.map(point => [point.lat, point.lng] as GeoMapLatLng)
        )
      : []

  const polygonPoints =
    target === 'all'
      ? polygons.flatMap(polygon =>
          polygon.points.map(point => [point.lat, point.lng] as GeoMapLatLng)
        )
      : []

  return [...markerPoints, ...routePoints, ...polygonPoints]
}
```

Update all callers (`resolveFitPointsWithFallback`, `resolveInitialView`, the `ViewportController` effect) to pass `polygons` through. Use find-and-replace — there are only ~5 call sites.

- [ ] **Step 7.4: Render polygons after routes, before markers**

Inside the `<MapContainer>` JSX, after the `{resolvedRoutes.map(...)}` block but before the cluster/marker block, add:

```tsx
{
  resolvedPolygons.map((polygon, polygonIndex) => {
    const polygonKey = polygon.id ?? `${id}-polygon-${polygonIndex}`
    const positions = polygon.points.map(point => [point.lat, point.lng]) as [
      number,
      number
    ][]
    const tooltipMode = polygon.tooltip ?? 'hover'
    const tooltipContent = polygon.label ?? polygon.description

    return (
      <Polygon
        key={polygonKey}
        positions={positions}
        pathOptions={{
          color: polygon.borderColor ?? 'var(--primary)',
          weight: polygon.borderWeight ?? 2,
          opacity: polygon.borderOpacity ?? 0.8,
          dashArray: polygon.borderDashArray,
          fillColor: polygon.fillColor ?? 'var(--primary)',
          fillOpacity: polygon.fillOpacity ?? 0.15
        }}
      >
        <GeoMapOverlays
          tooltipMode={tooltipMode}
          tooltipContent={tooltipContent}
          label={polygon.label}
          description={polygon.description}
          tooltipClassName={tooltipClassName}
          popupClassName={popupClassName}
        />
      </Polygon>
    )
  })
}
```

- [ ] **Step 7.5: Wire the prop in `geo-map.tsx`**

Open `components/tool-ui/geo-map/geo-map.tsx`. The `GeoMapProps` type already comes from the schema, so `polygons` is already present — just thread it through to the engine. Find the `<GeoMapEngine ... />` call and add the prop:

```tsx
polygons = { polygons }
```

Also pull `polygons` out of the `GeoMap` function's destructured props at the top of the component.

- [ ] **Step 7.6: Run every test that might touch this**

Run: `bun run test -- components/tool-ui/geo-map`
Expected: all pass.

- [ ] **Step 7.7: Typecheck + lint**

Run: `bun typecheck && bun lint`

- [ ] **Step 7.8: Smoke test in the browser**

Start (or keep running) `bun dev`. Open a chat and ask something like: "Show me a map of San Francisco with a polygon outlining the Mission District." Since the researcher doesn't yet know about `getIsochrone`, you'll need to manually craft a JSON call — easiest path is to write a one-off page or use the React DevTools to pass polygons directly. Verify:

- Polygon renders with fill + border
- Hover tooltip appears
- Zoom still works

If you prefer, defer visual verification to Task 12 where the researcher can produce polygons naturally via `getIsochrone`.

- [ ] **Step 7.9: Commit**

```bash
git add components/tool-ui/geo-map/_adapter.tsx components/tool-ui/geo-map/geo-map-engine.tsx components/tool-ui/geo-map/geo-map.tsx
git commit -m "feat(geo-map): render polygons + include polygon verts in fit"
```

---

## Task 8: Register the four new tools with the researcher

**Files:**

- Modify: `lib/types/agent.ts`
- Modify: `lib/agents/researcher.ts`

- [ ] **Step 8.1: Add tool imports + types**

Open `lib/types/agent.ts`. Add import lines alphabetically:

```typescript
import type { geocodeAddressTool } from '../tools/geocode-address'
import type { getDirectionsTool } from '../tools/get-directions'
import type { getIsochroneTool } from '../tools/get-isochrone'
import type { getStaticMapImageTool } from '../tools/get-static-map-image'
```

Extend `ResearcherTools`:

```typescript
export type ResearcherTools = {
  search: ReturnType<typeof createSearchTool>
  fetch: typeof fetchTool
  displayPlan: typeof displayPlanTool
  displayTable: typeof displayTableTool
  displayChart: typeof displayChartTool
  displayGeoMap: typeof displayGeoMapTool
  getDirections: typeof getDirectionsTool
  geocodeAddress: typeof geocodeAddressTool
  getIsochrone: typeof getIsochroneTool
  getStaticMapImage: typeof getStaticMapImageTool
  displayCitations: typeof displayCitationsTool
  displayLinkPreview: typeof displayLinkPreviewTool
  displayOptionList: typeof displayOptionListTool
  displayQuestionWizard: typeof displayQuestionWizardTool
  displayCallout: typeof displayCalloutTool
  displayTimeline: typeof displayTimelineTool
  createCanvasArtifact: ReturnType<typeof createCanvasArtifactTool>
  updateCanvasArtifact: ReturnType<typeof updateCanvasArtifactTool>
  readCanvasArtifact: ReturnType<typeof readCanvasArtifactTool>
  generateImage: ReturnType<typeof createGenerateImageTool>
} & ReturnType<typeof createTodoTools>
```

Add UIToolInvocation exports near the existing block (around line 73):

```typescript
export type GetDirectionsToolInvocation = UIToolInvocation<
  ResearcherTools['getDirections']
>
export type GeocodeAddressToolInvocation = UIToolInvocation<
  ResearcherTools['geocodeAddress']
>
export type GetIsochroneToolInvocation = UIToolInvocation<
  ResearcherTools['getIsochrone']
>
export type GetStaticMapImageToolInvocation = UIToolInvocation<
  ResearcherTools['getStaticMapImage']
>
```

> If Task 4 was skipped, omit `getIsochrone` from both `ResearcherTools` and the UIToolInvocation exports.

- [ ] **Step 8.2: Register tools in the researcher**

Open `lib/agents/researcher.ts`. Add imports:

```typescript
import { geocodeAddressTool } from '../tools/geocode-address'
import { getDirectionsTool } from '../tools/get-directions'
import { getIsochroneTool } from '../tools/get-isochrone'
import { getStaticMapImageTool } from '../tools/get-static-map-image'
```

In the `chat` case's `activeToolsList` (around line 202), add after `'displayGeoMap'`:

```typescript
          'getDirections',
          'geocodeAddress',
          'getIsochrone',
          'getStaticMapImage',
```

In the `research` case's `activeToolsList` (around line 226), same additions.

In the `tools` object (around line 308), add after `displayGeoMap: displayGeoMapTool,`:

```typescript
      getDirections: getDirectionsTool,
      geocodeAddress: geocodeAddressTool,
      getIsochrone: getIsochroneTool,
      getStaticMapImage: getStaticMapImageTool,
```

> If Task 4 was skipped, omit all four lines of `getIsochrone` from this task.

- [ ] **Step 8.3: Run typecheck + lint**

Run: `bun typecheck && bun lint`
Expected: both pass. The type system should confirm the tools are correctly typed against `ResearcherTools`.

- [ ] **Step 8.4: Run any existing researcher tests**

Run: `bun run test -- lib/agents/__tests__`
Expected: all pass. The researcher test file (`researcher.test.ts`) may assert on tool lists — if it does, update it to include the new tool names.

- [ ] **Step 8.5: Commit**

```bash
git add lib/types/agent.ts lib/agents/researcher.ts lib/agents/__tests__/researcher.test.ts
git commit -m "feat(researcher): register getDirections, geocodeAddress, getIsochrone, getStaticMapImage"
```

---

## Task 9: Add `.describe()` annotations to `displayGeoMap` schema fields

**Files:**

- Modify: `lib/tools/display-geo-map.ts`

These inline hints are the most effective place to teach the model _how_ to populate each field, because they show up in the tool's JSON Schema the model sees alongside each field. Purely additive — no field removals, no type changes.

- [ ] **Step 9.1: Write a test that asserts the describes are present**

Open `lib/tools/__tests__/display-geo-map.test.ts` and append:

```typescript
import { DisplayGeoMapSchema } from '../display-geo-map'

describe('DisplayGeoMapSchema .describe() annotations', () => {
  it('documents non-obvious marker fields', () => {
    const jsonSchema = JSON.stringify(DisplayGeoMapSchema)
    expect(jsonSchema).toContain('category color coding')
    expect(jsonSchema).toContain("'always' forces the label")
    expect(jsonSchema).toContain('Emoji character')
  })

  it('documents clustering guidance', () => {
    const jsonSchema = JSON.stringify(DisplayGeoMapSchema)
    expect(jsonSchema).toContain('>20 markers')
  })

  it('documents route styling fields', () => {
    const jsonSchema = JSON.stringify(DisplayGeoMapSchema)
    expect(jsonSchema).toContain('dashArray')
    expect(jsonSchema).toContain('6,4')
  })
})
```

- [ ] **Step 9.2: Run — confirm failure**

Run: `bun run test -- lib/tools/__tests__/display-geo-map.test.ts`
Expected: the new describe tests fail.

- [ ] **Step 9.3: Add `.describe()` annotations**

In `lib/tools/display-geo-map.ts`, modify the schemas:

```typescript
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
```

Update marker-level fields:

```typescript
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
```

Update route fields:

```typescript
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
```

Update clustering:

```typescript
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
```

Update viewport:

```typescript
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
```

- [ ] **Step 9.4: Run test — confirm pass**

Run: `bun run test -- lib/tools/__tests__/display-geo-map.test.ts`
Expected: the describe tests now pass.

- [ ] **Step 9.5: Typecheck + lint**

Run: `bun typecheck && bun lint`

- [ ] **Step 9.6: Commit**

```bash
git add lib/tools/display-geo-map.ts lib/tools/__tests__/display-geo-map.test.ts
git commit -m "feat(display-geo-map): document non-obvious fields via .describe()"
```

---

## Task 10: Additively expand the `displayGeoMap` prompt block

**Files:**

- Modify: `lib/agents/prompts/search-mode-prompts.ts`

Both `RESEARCH_MODE_PROMPT` and `CHAT_MODE_PROMPT` have a 4-bullet `**displayGeoMap**` section (lines 257–260 and 568–571). Append richer bullets covering clustering, icons, tooltip modes, route styling, and marker descriptions — keep existing bullets verbatim.

- [ ] **Step 10.1: Append richer guidance in the research-mode block**

In `lib/agents/prompts/search-mode-prompts.ts`, find the research-mode `**displayGeoMap**` block (around line 257). After the existing `- Prefer \`viewport.mode="fit"\`...` line, append these bullets (keep the four-bullet preamble untouched):

```
- For multi-location answers (comparisons, top-N lists, regional overviews), always emit MULTIPLE markers — one per place — not a single combined marker
- Use EMOJI icons to encode category across heterogeneous pins: 🏛️ museums, 🍣 sushi, ⛰️ peaks, 🏨 hotels, 🍷 wineries, ✈️ airports, ⛪ religious sites, 🎓 universities, 🏟️ stadiums, ⛽ gas, 🏥 hospitals, 🌳 parks
- Populate \`description\` whenever each marker has a concrete detail worth knowing (address, distance, key fact, rating, year). Empty descriptions waste the popup
- Use \`tooltip: "always"\` on overview maps where the user should read every label without interacting — "top 5 national parks", "wine regions of Burgundy". Leave it at the default ("hover") for dense/clustered maps
- Enable \`clustering.enabled = true\` when rendering >20 markers in a modest bounding box; leave OFF for small N or wide-area maps
- Style routes: use solid lines for physical routes (driving, walking, flight paths) and \`dashArray: "6,4"\` for conceptual or historical ones (Silk Road, Beagle voyage). Pick warm colors for live/current and cool colors for planned/past
- Prefer COMPOSED calls: when the user asks for directions or a trip, call \`getDirections\` first, then pass its \`points[]\` as \`routes[0].points\` in \`displayGeoMap\`, with origin/destination as markers. Put the route's duration/distance label in \`routes[0].label\`
- Always resolve addresses via \`geocodeAddress\` before placing a pin — do NOT guess lat/lng from memory, it is frequently wrong
- Use \`viewport.target = "routes"\` when the markers are endpoint-only and the route shape is the interesting thing (e.g., cross-country drives); otherwise keep \`target: "all"\`
```

- [ ] **Step 10.2: Append the same guidance in the chat-mode block**

Find the chat-mode `**displayGeoMap**` block (around line 568). Append the exact same bullet list from Step 10.1 after its existing final bullet.

> Why duplicated: per the user's additive-only requirement, we do not consolidate the two blocks in this plan. Future refactor can hoist them into a shared constant.

- [ ] **Step 10.3: Lint + typecheck**

Run: `bun typecheck && bun lint`
Expected: both pass. (Prompt text changes shouldn't affect types, but confirm.)

- [ ] **Step 10.4: Run any prompt-adjacent tests**

Run: `bun run test -- lib/agents/__tests__ lib/utils/__tests__/message-mapping-display-tools.test.ts`
Expected: all pass. If any test snapshots the prompt text, update the snapshot.

- [ ] **Step 10.5: Commit**

```bash
git add lib/agents/prompts/search-mode-prompts.ts
git commit -m "feat(prompts): expand displayGeoMap guidance additively (both modes)"
```

---

## Task 11: Add new prompt blocks for the four new tools

**Files:**

- Modify: `lib/agents/prompts/search-mode-prompts.ts`

Each new tool gets a dedicated block in the `DISPLAY TOOLS` / `ACTION TOOLS` section of both mode prompts. Insert the four blocks together after the (now-expanded) `displayGeoMap` block in each mode copy.

- [ ] **Step 11.1: Insert new blocks in the research-mode section**

After the final bullet of the research-mode `displayGeoMap` block (around line 269 after the expansion from Task 10), insert:

```
**getDirections** — Use to compute a real road-following route between two or more points:
- TRIGGER: "directions", "how do I get to", "route from X to Y", "fastest way", "how long does it take to drive", trip planning, "X to Y by car/bike/foot"
- Call this FIRST, then feed its \`points[]\` array into \`displayGeoMap.routes[0].points\` and label the route with the returned \`durationLabel · distanceLabel\`
- Supported profiles: driving, walking, cycling. For transit, the tool returns \`state: "not_supported"\` — when this happens, tell the user transit directions are not yet available and suggest Google Maps or their local transit authority
- Multi-stop trips: pass intermediate stops in \`waypoints[]\` in travel order. The returned \`points[]\` covers the full sequence

**geocodeAddress** — Use to resolve a place name or address to coordinates:
- TRIGGER: Any question where the user references a place by name/address that is not obviously a well-known city (e.g. "123 Main St, Phoenix", "the Louvre", "Ben & Jerry's in Waterbury")
- ALWAYS geocode before pinning. Do NOT guess lat/lng from memory — the result is routinely a block or a neighborhood off
- Use \`limit > 1\` only when the query is genuinely ambiguous ("Springfield", "Portland" could be several places); otherwise \`limit = 1\` is cheaper and clearer

**getIsochrone** — Use to compute a reachability polygon:
- TRIGGER: "within X minutes", "reach in 30 min", "how far can I get by car/walking/bike in...", drive-time housing questions, "neighborhoods within commute distance of..."
- Returns a polygon that you should pass into \`displayGeoMap.polygons[0].points\` with a fill color and matching label
- Requires ORS_API_KEY server-side. If it returns \`state: "error"\` with a message mentioning ORS_API_KEY, tell the user the feature is not configured in this deployment

**getStaticMapImage** — Use to generate a shareable PNG URL of a map:
- TRIGGER: "export this as an image", "give me a shareable map", "what would this look like as a still", or when you want to embed a map in a canvas artifact where an interactive map is overkill
- Prefer \`displayGeoMap\` for in-chat maps; use \`getStaticMapImage\` only when a static image is explicitly preferable (emails, social embeds, canvas artifacts)
```

> If Task 4 was skipped, omit the `**getIsochrone**` block and any references to `polygons[]` across these insertions.

- [ ] **Step 11.2: Insert the same blocks in the chat-mode section**

After the final bullet of the chat-mode expanded `displayGeoMap` block (around line 580 after Task 10), insert the exact same four blocks from Step 11.1.

- [ ] **Step 11.3: Lint + typecheck**

Run: `bun typecheck && bun lint`

- [ ] **Step 11.4: Tests**

Run: `bun run test -- lib/agents`
Expected: all pass.

- [ ] **Step 11.5: Commit**

```bash
git add lib/agents/prompts/search-mode-prompts.ts
git commit -m "feat(prompts): add guidance blocks for directions/geocoding/isochrones/static"
```

---

## Task 12: End-to-end smoke test in the browser

**Files:** No code changes — manual verification.

Verify the full composition works: agent → geocode → directions → display-geo-map.

- [ ] **Step 12.1: Confirm dev server has the new env (and maybe ORS)**

Run: `bun dev` (restart if it was already running before Task 1).

If Task 4 was implemented, make sure `.env.local` has `ORS_API_KEY=...`.

- [ ] **Step 12.2: Driving route smoke test**

In a chat, ask: **"Give me a driving route from San Francisco Ferry Building to Mountain View Caltrain station. Show it on a map."**

Expected:

- Agent calls `geocodeAddress` twice (or uses known coords), then `getDirections` with `profile: 'driving'`, then `displayGeoMap`
- Map renders with two markers (origin + destination)
- Route polyline follows actual streets (US-101, not a diagonal line)
- Route label shows something like "~50 min · ~37 mi"
- Viewport fits both markers

- [ ] **Step 12.3: Walking route smoke test**

Ask: **"What's the walking route from the Louvre to Notre-Dame?"**

Expected similar behavior with `profile: 'walking'` and a shorter duration.

- [ ] **Step 12.4: Transit fallback smoke test**

Ask: **"What's the best public transit from Brooklyn to JFK?"**

Expected:

- Agent calls `getDirections` with `profile: 'transit'`
- Gets back `state: 'not_supported'`
- Response to user acknowledges the limitation and suggests Google Maps (or equivalent)
- Does NOT silently fall back to driving without saying so

- [ ] **Step 12.5: Multi-marker comparison**

Ask: **"Show me the top 5 Michelin three-star restaurants in Tokyo on a map."**

Expected:

- 5 markers with emoji icons (🍣 or 🍴 or similar)
- Each marker has a description (address or specialty)
- Viewport fits all 5
- If clustering is sensible (compact geographic region), markers are clearly readable without overlap — depending on spread, clustering may or may not be enabled

- [ ] **Step 12.6: Isochrone smoke test (only if Task 4 done)**

Ask: **"What neighborhoods are within a 20-minute drive of downtown Seattle?"**

Expected:

- Agent calls `geocodeAddress` for downtown Seattle, then `getIsochrone` with `durationMinutes: 20, profile: 'driving'`
- Map renders with a polygon shaded area + a center marker
- Polygon has a semi-transparent fill and visible border

- [ ] **Step 12.7: Address pinpoint smoke test**

Ask: **"Put a pin on 2450 Mission St, San Francisco."**

Expected:

- Agent calls `geocodeAddress`, gets precise coords
- Map is centered on the actual building, not somewhere near it
- Previously (pre-geocode tool), coords were hallucinated — verify the pin is on the right block

- [ ] **Step 12.8: Commit a brief CHANGELOG / release notes if your project maintains one**

Optional — only if the project tracks changelog. Otherwise skip.

---

## Self-Review checklist (plan author)

**Spec coverage:**

- ✅ Tier 2 item #1 (driving routes with walk/cycle) → Task 2
- ✅ Tier 2 item #1 (public transit) → Task 2 (stubbed + prompt fallback, documented)
- ✅ Tier 2 item #2 (geocoding) → Task 3
- ✅ Tier 2 item #3 (isochrones) → Task 4 (optional, documented dependency)
- ✅ Tier 2 item #4 (static maps) → Task 5
- ✅ Polygon schema primitive for isochrones → Task 6 + Task 7
- ✅ Tool registration → Task 8
- ✅ Additive prompt updates (Tier 1 capabilities) → Task 9 + Task 10
- ✅ Prompt updates for new tools → Task 11
- ✅ Smoke-test verification → Task 12

**Placeholder scan:** No "TBD", no "handle edge cases" without code, no "similar to above" — each task has its own complete code blocks.

**Type consistency:** `GeoMapPolygon` named consistently across schema.ts and display-geo-map.ts. `GetDirectionsResult.profile` matches the input enum. `ResearcherTools` keys match the `tools` object keys in researcher.ts.

**Explicit opt-out paths:** Task 4 (isochrones) is clearly marked optional with instructions for how to omit it across Tasks 6, 8, 11.
