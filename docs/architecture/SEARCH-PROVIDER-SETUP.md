# Search Provider Setup

> **Audience:** Contributor | Operator
> **Prerequisites:** [Search Providers](SEARCH-PROVIDERS.md)

This leaf lists environment variables and runtime behavior for each supported search provider.

## Configuring Providers

### Tavily

An AI-focused search provider. Returns rich content snippets, image descriptions, and optional answer summaries.

**Environment variables:**

```
TAVILY_API_KEY=tvly-...
SEARCH_API=tavily          # Required to use Tavily instead of Brave
```

**Features:**

- Minimum 5-character query enforced (padded if shorter)
- Minimum 5 results per request (even if fewer requested)
- `include_answers: true` returns an AI-generated answer alongside results
- `include_image_descriptions: true` returns descriptive text for each image
- Supports both `basic` and `advanced` search depth
- Full domain include/exclude filtering

**Source:** `lib/tools/search/providers/tavily.ts`

---

### Brave (Default)

The default search provider with multimedia support. Brave is the only provider that supports video and image content types as separate search endpoints.

**Environment variables:**

```
BRAVE_SEARCH_API_KEY=BSA...
```

**Features:**

- Sequential execution of web, video, and image searches when multiple content types are requested
- Video results include thumbnails, duration, publisher, and date
- Image results include thumbnails with multiple fallback sources
- Automatically selected for `type="general"` searches when API key is present
- Does not support domain filtering or search depth

**Content types:**

| Content Type | Brave Endpoint          | Returned Data                         |
| ------------ | ----------------------- | ------------------------------------- |
| `web`        | `/res/v1/web/search`    | Title, description, URL               |
| `video`      | `/res/v1/videos/search` | Title, thumbnail, duration, publisher |
| `image`      | `/res/v1/images/search` | Title, thumbnail URL, dimensions      |

**Source:** `lib/tools/search/providers/brave.ts`

---

### Exa

An AI-native search engine that returns highlighted content snippets. Uses the official `exa-js` SDK.

**Environment variables:**

```
EXA_API_KEY=...
SEARCH_API=exa
```

**Features:**

- Uses `searchAndContents` with highlights enabled
- Returns highlighted content passages (joined with spaces)
- Supports domain include/exclude filtering
- Search depth parameter is accepted but ignored
- Does not return images

**Source:** `lib/tools/search/providers/exa.ts`

---

### SearXNG

A self-hosted, privacy-respecting metasearch engine. SearXNG aggregates results from multiple upstream engines (Google, Bing, DuckDuckGo, Wikipedia).

**Environment variables:**

```
SEARXNG_API_URL=http://localhost:8080     # Base URL of your SearXNG instance
SEARCH_API=searxng
SEARXNG_DEFAULT_DEPTH=basic               # Optional, set to 'advanced' for default advanced depth
```

**Features:**

- Self-hosted (no API key required, just a URL)
- Aggregates results across general and image categories
- Search depth changes engine selection and safety settings:
  - `basic`: Google + Bing, safesearch on, time range limited to past year
  - `advanced`: Google + Bing + DuckDuckGo + Wikipedia, safesearch off, no time range limit
- Domain include filtering via `site` parameter (exclude not supported)
- Supports advanced search via a dedicated `/api/advanced-search` route (SearXNG only)
- Image URLs are resolved relative to the SearXNG instance URL when needed

**Source:** `lib/tools/search/providers/searxng.ts`

#### SearXNG Advanced Search Mode

When `SEARXNG_DEFAULT_DEPTH=advanced` is set, searches are routed through a dedicated `/api/advanced-search` API route instead of querying SearXNG directly. This route performs deep content extraction with page crawling, relevance scoring, and Redis caching.

**Additional environment variables for advanced mode:**

```
SEARXNG_DEFAULT_DEPTH=advanced                          # Enables the advanced search route
SEARXNG_ENGINES=google,bing,duckduckgo,wikipedia        # Engines to query (default)
SEARXNG_TIME_RANGE=None                                 # Time filter (None = no filter)
SEARXNG_SAFESEARCH=0                                    # Safe search level (0 = off)
SEARXNG_MAX_RESULTS=50                                  # Max results cap (10-100, default 50)
SEARXNG_CRAWL_MULTIPLIER=4                              # Fetch N * multiplier pages, keep top N
```
