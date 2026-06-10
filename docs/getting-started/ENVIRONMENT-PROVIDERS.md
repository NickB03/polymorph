# Environment Provider Variables

> **Audience:** New Developer | Contributor
> **Prerequisites:** [Environment Reference](ENVIRONMENT.md)

This leaf groups search, AI, voice, canvas, optional feature, and map tile variables.

## Search provider options

- `BRAVE_SEARCH_API_KEY` (primary search provider; preferred for general web research and multimedia results)
- `TAVILY_API_KEY` (secondary search provider and optional extract fallback for `fetch type="api"`)
- `EXA_API_KEY` (tertiary text-search fallback when Brave and Tavily fail)
- `JINA_API_KEY` (optional extract provider for `fetch type="api"`, not required for the default setup)
- `SEARCH_API` (`brave`, `tavily`, `exa`, `searxng`, `firecrawl`)
- `FIRECRAWL_API_KEY` (if selected explicitly)
- `SEARXNG_API_URL` (required when `SEARCH_API=searxng`)

When using SearXNG, the following optional tuning variables are read by `lib/tools/search/advanced-search.ts` (see the full table in [API → /api/advanced-search](../reference/API-AUXILIARY-ENDPOINTS.md#post-apiadvanced-search)):

- `SEARXNG_MAX_RESULTS` (default `50`), `SEARXNG_DEFAULT_DEPTH` (default `basic`), `SEARXNG_ENGINES`, `SEARXNG_TIME_RANGE`, `SEARXNG_SAFESEARCH`, `SEARXNG_CRAWL_MULTIPLIER`
- `LOCAL_REDIS_URL` (default `redis://localhost:6379`) — Redis connection used to cache advanced-search results in non-cloud setups

`fetch type="api"` is reserved for PDFs and explicit extraction needs on hard-to-parse pages. Normal HTML article pages should generally be handled by search results or `fetch type="regular"`, which keeps research resilient even when an extractor is rate-limited or quota-limited.

## AI provider options (Direct)

- `OPENROUTER_API_KEY` (default text model provider)
- `AI_GATEWAY_API_KEY` (image generation via Vercel AI Gateway)
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `OPENAI_COMPATIBLE_API_KEY` + `OPENAI_COMPATIBLE_API_BASE_URL` (any OpenAI-compatible API)
- `OLLAMA_BASE_URL`

## Voice / text-to-speech

Voice synthesis (`POST /api/voice/synthesize`) is feature-gated and off by default.

| Variable                   | Default                | Purpose                                                                                                                                |
| -------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_ENABLE_VOICE` | `false`                | Client + server feature gate for voice synthesis (`lib/voice/config.ts`). The synth endpoint returns 404 when unset.                   |
| `ELEVENLABS_API_KEY`       | —                      | Enables the ElevenLabs TTS provider (`lib/voice/tts-provider.ts`). When unset, the server falls back to OpenAI TTS (`OPENAI_API_KEY`). |
| `ELEVENLABS_VOICE_ID`      | `DXFkLCBUTmvXpp2QwZjA` | Default ElevenLabs voice ID when the request does not specify one (`app/api/voice/synthesize/route.ts`).                               |

## Canvas artifacts

| Variable              | Default | Purpose                                                                                                                                                                           |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GUEST_CANVAS_SECRET` | —       | HMAC-SHA256 secret for signing guest canvas tokens (required for guest artifact use). `GUEST_ARTIFACT_SECRET` is also accepted as a backward-compatible fallback in local setups. |

## Optional platform features

- Guest mode: `ENABLE_GUEST_CHAT` (recommended), `GUEST_CHAT_DAILY_LIMIT`
- Authenticated chat limit: `DAILY_CHAT_LIMIT` (default `100`) — daily cap per authenticated user, enforced in cloud mode (`lib/rate-limit/chat-limits.ts`)
- Site feedback → Slack: `SLACK_WEBHOOK_URL` — when set, the feedback action posts submissions to Slack (`lib/actions/site-feedback.ts`)
- Tracing/observability: see [Tracing (Arize Phoenix)](ENVIRONMENT-OPERATIONS.md#tracing-arize-phoenix)
- Performance diagnostics: `ENABLE_PERF_LOGGING`
- Canvas compiler debug logging: `DEBUG_CANVAS_COMPILER` (`lib/canvas/compiler/compile-canvas-artifact.ts`)

## Map tiles (geo-map Tool UI)

| Variable                       | Required    | Purpose                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MAPTILER_API_KEY` | Recommended | **Client-side MapTiler key** for `streets-v2` (light) and `streets-v2-dark` basemaps — reaches the browser. Lock this key's "allowed origins" in the MapTiler dashboard to production + localhost. Free tier: 100K tile loads/month, commercial use permitted. When unset, the map falls back to CARTO Voyager (light only).                          |
| `MAPTILER_API_KEY`             | Recommended | **Server-only MapTiler key** for `getDirections`, `geocodeAddress`, `getStaticMapImage` tools. Generate a second key in the MapTiler dashboard with no origin restriction. When unset, server tools fall back to `NEXT_PUBLIC_MAPTILER_API_KEY`, but keeping a separate server-only key gives defense in depth if the public key's origin-lock fails. |
| `ORS_API_KEY`                  | Optional    | OpenRouteService API key for the `getIsochrone` tool. Free tier: 2500 requests/day. Sign up at https://openrouteservice.org/dev/#/signup. When unset, `getIsochrone` returns an error result gracefully.                                                                                                                                              |
