# Auxiliary API Endpoints

> **Audience:** Contributor | Operator
> **Prerequisites:** [API Reference](API.md)

This leaf covers advanced search, suggestions, voice synthesis, and health check endpoints.

## POST `/api/advanced-search`

Performs a SearXNG-powered web search with optional deep crawling and relevance scoring. Results are cached in Redis for 1 hour.

**Authentication:** None

> **Note:** This endpoint requires a self-hosted SearXNG instance. It is separate from the primary Brave search (and Tavily/Exa fallbacks) used by the chat agent tools.

#### Request Body

```typescript
{
  query: string                // Search query
  maxResults?: number          // Max results to return (capped at SEARXNG_MAX_RESULTS)
  searchDepth?: "basic" | "advanced"  // "advanced" enables page crawling
  includeDomains?: string[]    // Only include results from these domains
  excludeDomains?: string[]    // Exclude results from these domains
}
```

| Field            | Type       | Required | Description                                                                                                                                            |
| ---------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `query`          | `string`   | Yes      | The search query string.                                                                                                                               |
| `maxResults`     | `number`   | No       | Maximum number of results. Capped by `SEARXNG_MAX_RESULTS` env var (default 50).                                                                       |
| `searchDepth`    | `string`   | No       | `"basic"` returns SearXNG snippets; `"advanced"` crawls pages, extracts content, and ranks by relevance. Default from `SEARXNG_DEFAULT_DEPTH` env var. |
| `includeDomains` | `string[]` | No       | Filter results to only these domains.                                                                                                                  |
| `excludeDomains` | `string[]` | No       | Exclude results from these domains.                                                                                                                    |

#### Response

**Content-Type:** `application/json`

```typescript
{
  results: Array<{
    title: string            // Page title
    url: string              // Page URL
    content: string          // Snippet or extracted content
  }>
  query: string              // Echo of the search query
  images: string[]           // Array of image URLs from results
  number_of_results: number  // Total number of results found
}
```

#### Error Responses

| Status | Body                                                                                                       | Condition                                   |
| ------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `500`  | `{ message: "Internal Server Error", error: "...", query, results: [], images: [], number_of_results: 0 }` | SearXNG API failure or configuration error. |

#### Environment Variables

| Variable                   | Default                              | Description                                             |
| -------------------------- | ------------------------------------ | ------------------------------------------------------- |
| `SEARXNG_API_URL`          | (required)                           | Base URL of the SearXNG instance.                       |
| `SEARXNG_MAX_RESULTS`      | `50`                                 | Maximum results cap (10-100).                           |
| `SEARXNG_DEFAULT_DEPTH`    | `"basic"`                            | Default search depth.                                   |
| `SEARXNG_ENGINES`          | `"google,bing,duckduckgo,wikipedia"` | Comma-separated search engines.                         |
| `SEARXNG_TIME_RANGE`       | `"None"`                             | Time range filter (e.g., `"day"`, `"week"`, `"month"`). |
| `SEARXNG_SAFESEARCH`       | `"0"`                                | Safe search level (0=off, 1=moderate, 2=strict).        |
| `SEARXNG_CRAWL_MULTIPLIER` | `"4"`                                | Multiplier for pages to crawl in advanced mode.         |

---

## GET `/api/suggestions`

Returns trending topic suggestions for the homepage, grouped by category. Reads the `trending_suggestions_cache` Postgres singleton (updated daily by the Vercel cron at `/api/suggestions/refresh`) and blends dynamic suggestions with a static rotation fallback.

**Authentication:** None

#### Response

**Content-Type:** `application/json`

```typescript
{
  research: string[]
  compare: string[]
  creative: string[]
  technical: string[]
}
```

**Headers:**

- `x-suggestions-source` -- Source of suggestions (`dynamic-blend` when cached dynamic suggestions are blended with static rotation, otherwise `static-rotation`)
- `Cache-Control` / `CDN-Cache-Control` -- CDN cache headers with stale-while-revalidate behavior

---

## GET `/api/suggestions/refresh`

Vercel-cron-only endpoint that regenerates the `trending_suggestions_cache` singleton via the privileged DB client. Bearer-auth gated by `CRON_SECRET`. Schedule and operational details live in [Deployment → Vercel cron](../operations/DEPLOYMENT-PRODUCTION.md#vercel-cron--trending-suggestions-refresh); env vars in [Environment → Vercel cron jobs](../getting-started/ENVIRONMENT-OPERATIONS.md#vercel-cron-jobs).

---

## POST `/api/voice/synthesize`

Synthesizes text-to-speech audio using a server-side TTS provider (OpenAI or ElevenLabs).

**Authentication:** Required (or guest mode enabled)
**Dynamic:** `force-dynamic`

#### Request Body

```typescript
{
  text: string              // Text to synthesize (truncated to max chars limit)
  provider?: string         // Preferred TTS provider ("openai" or "elevenlabs")
  voiceId?: string          // Voice ID for the selected provider
}
```

#### Response

**Content-Type:** `audio/mpeg`

Returns a streaming audio response.

#### Error Responses

| Status | Condition                                                             |
| ------ | --------------------------------------------------------------------- |
| `400`  | Missing or invalid `text` field.                                      |
| `401`  | User not authenticated and guest mode disabled.                       |
| `404`  | Voice feature not enabled (`NEXT_PUBLIC_ENABLE_VOICE` is not `true`). |
| `422`  | No server-side TTS provider configured.                               |

---

## GET `/api/health`

Health check endpoint for monitoring and load balancers. Verifies database connectivity with a 5-second timeout. Optionally checks Phoenix collector connectivity.

**Authentication:** None
**Dynamic:** `force-dynamic`

For Vercel monitoring, use the canonical production alias (`https://polymorph.fyi/api/health`). Raw deployment URLs may be protected by Vercel Authentication even when the application route itself is public.

#### Query Parameters

| Parameter | Values           | Description                                                        |
| --------- | ---------------- | ------------------------------------------------------------------ |
| `check`   | `phoenix`, `all` | Include optional Phoenix collector connectivity check (3s timeout) |

#### Response

**Content-Type:** `application/json`

**Healthy (200):**

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "db": "connected"
}
```

**Healthy with Phoenix check (200):**

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "db": "connected",
  "phoenix": "ok",
  "tracing": "enabled"
}
```

**Unhealthy (503):**

```json
{
  "status": "error",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "db": "error",
  "dbError": "unreachable"
}
```

> **Note:** Phoenix status is advisory-only and does not affect the HTTP status code. The endpoint returns 503 only when the database is unreachable.

> **`phoenix: 'ok'` is not proof tracing is active.** With `check=phoenix` or `check=all`, the response also includes `tracing`, one of `enabled` | `disabled-off` | `disabled-https` | `init-failed` | `unknown`. `phoenix` reports whether the Phoenix collector is reachable over the network; `tracing` reports whether _this process_ actually registered an OTel exporter (set in `instrumentation.ts`). The blind-deploy signature to watch for is `phoenix: 'ok'` together with `tracing: 'disabled-https'` — the collector is up, but this deployment silently disabled export because `PHOENIX_COLLECTOR_ENDPOINT` wasn't `https://` in production (see [Environment Operations → Tracing](../getting-started/ENVIRONMENT-OPERATIONS.md#tracing-arize-phoenix)).

---
