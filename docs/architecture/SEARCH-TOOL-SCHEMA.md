# Search Tool Schema

> **Audience:** Contributor | Operator
> **Prerequisites:** [Search Providers](SEARCH-PROVIDERS.md)

This leaf documents chat vs research search behavior, the search tool schema, search types, and the extension path for new providers.

## Search in Chat vs Research Modes

The chat agent system has two search behaviors, applied per agent:

| Aspect          | Chat Mode                        | Research Mode                                   |
| --------------- | -------------------------------- | ----------------------------------------------- |
| Max agent steps | 20                               | 50                                              |
| Search type     | Forced `optimized` (wrapped)     | Agent chooses `general` or `optimized`          |
| Available tools | `search`, `fetch`, display tools | `search`, `fetch`, `todoWrite`\*, display tools |
| Multimedia      | Not available (always optimized) | Available if Brave is configured                |

\* `todoWrite` is available when a stream writer is present (i.e., during streaming responses).

In the **search** and **build** agents, the search tool is wrapped by `wrapSearchToolForChatMode` (in [`lib/agents/chat/search.ts`](../../lib/agents/chat/search.ts)) to force `type: "optimized"` on every call, ensuring fast content-rich results regardless of what the agent requests. The **research** agent skips this wrapper and accepts the full search type set.

In **Research Mode**, the agent freely chooses between `type: "general"` and `type: "optimized"`, enabling multimedia search through Brave when configured.

---

## Search Tool Schema

The search tool exposes these parameters to the agent (defined in `lib/tools/search/schema.ts`):

| Parameter         | Type                                        | Default       | Description                        |
| ----------------- | ------------------------------------------- | ------------- | ---------------------------------- |
| `query`           | string                                      | (required)    | Search query text                  |
| `type`            | `"general"` \| `"optimized"`                | `"optimized"` | Provider routing hint              |
| `content_types`   | `("web" \| "video" \| "image" \| "news")[]` | `["web"]`     | Content types (Brave only)         |
| `max_results`     | number                                      | 20            | Max results (minimum enforced: 10) |
| `search_depth`    | `"basic"` \| `"advanced"`                   | `"basic"`     | Search depth level                 |
| `include_domains` | string[]                                    | `[]`          | Restrict to these domains          |
| `exclude_domains` | string[]                                    | `[]`          | Exclude these domains              |

A strict variant of the schema (all fields required, no defaults) is used for OpenAI reasoning models whose names start with `o` (e.g., `o1`, `o3`).

---

## Search Types: Optimized vs General

The search tool supports two types that map to different provider behaviors:

### Optimized (Default)

Used by the configured `SEARCH_API` provider (Brave by default). Returns rich content snippets alongside results, reducing the need for follow-up fetch calls.

- Forced in Chat Mode (overridden by `wrapSearchToolForChatMode`)
- Best for research queries where content extraction matters
- Providers: Tavily, Exa, SearXNG, Firecrawl

### General

Intended for time-sensitive queries and multimedia content. Routes to Brave when available, otherwise falls back to the optimized provider.

- Available in Research Mode only (Chat Mode forces optimized)
- Supports `content_types` parameter for video/image filtering (Brave only)
- Results typically need a follow-up `fetch` call for detailed content
- Provider: Brave (when `BRAVE_SEARCH_API_KEY` is set)

The search config utility at `lib/utils/search-config.ts` dynamically adjusts the tool description and agent prompts based on which providers are available.

---

## Adding a New Provider

To add a new search provider:

### 1. Create the provider class

Create a new file at `lib/tools/search/providers/<name>.ts`:

```typescript
import { SearchResults } from '@/lib/types'
import { BaseSearchProvider } from './base'

export class MySearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number,
    searchDepth: 'basic' | 'advanced',
    includeDomains: string[],
    excludeDomains: string[],
    options?: {
      type?: 'general' | 'optimized'
      content_types?: Array<'web' | 'video' | 'image' | 'news'>
    }
  ): Promise<SearchResults> {
    const apiKey = process.env.MY_PROVIDER_API_KEY
    this.validateApiKey(apiKey, 'MY_PROVIDER')

    // Implement search logic...

    return {
      results: [
        // { title, url, content }
      ],
      query,
      images: [],
      number_of_results: 0
    }
  }
}
```

The `BaseSearchProvider` class provides `validateApiKey()` and `validateApiUrl()` helper methods.

### 2. Register in the factory

Update `lib/tools/search/providers/index.ts`:

```typescript
// Add to the type union
export type SearchProviderType =
  | 'tavily'
  | 'exa'
  | 'searxng'
  | 'firecrawl'
  | 'brave'
  | 'my-provider'  // Add here

// Add to the switch in createSearchProvider()
case 'my-provider':
  return new MySearchProvider()
```

### 3. Add environment variables

Add the API key to your `.env.local`:

```
MY_PROVIDER_API_KEY=...
SEARCH_API=my-provider
```

Update `docs/getting-started/ENVIRONMENT.md` under "Search provider options" and add a commented entry to `.env.local.example`.

### 4. Test with the agent

```bash
SEARCH_API=my-provider MY_PROVIDER_API_KEY=... bun dev
```

Verify that:

- The search tool returns valid results with `results`, `images`, `query`, and `number_of_results`
- Citation mapping works (applied automatically by `search.ts` after your provider returns)
- The agent can generate cited answers from the results
- Error cases (missing API key, network failures) throw descriptive errors

### 5. SearchResults interface

Your provider must return the `SearchResults` type defined in `lib/types`:

```typescript
interface SearchResults {
  results: SearchResultItem[] // { title, url, content?, description? }
  query: string
  images: (string | SearchResultImage)[]
  number_of_results: number
  videos?: SerperSearchResultItem[]
  citationMap?: Record<number, SearchResultItem>
  toolCallId?: string
}
```

The `citationMap` and `toolCallId` fields are added automatically by the search tool after your provider returns results.
