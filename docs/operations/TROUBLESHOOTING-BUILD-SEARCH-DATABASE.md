# Troubleshooting Build Search and Database Issues

> **Audience:** New Developer | Operator
> **Prerequisites:** [Troubleshooting](TROUBLESHOOTING.md)

This leaf covers build, search, database, and escalation paths.

## Build Issues

### ESLint Import Order Errors

**Symptoms:** ESLint reports errors like `Run autofix to sort these imports!` from the `simple-import-sort` plugin.

The project enforces a strict import order:

1. `react`, `next`
2. Third-party packages (`@?\\w`)
3. Internal paths in order: `@/types` > `@/config` > `@/lib` > `@/hooks` > `@/components/ui` > `@/components` > `@/registry` > `@/styles` > `@/app`
4. Side effects, parent imports, relative imports, styles

**Fix:**

```bash
bun lint --fix
```

### Prettier Formatting Failures

**Symptoms:** CI or `bun format:check` fails with formatting differences.

The project uses these Prettier rules:

- No semicolons
- Single quotes
- No trailing commas
- 2-space indentation
- Avoid arrow parens where possible
- LF line endings

**Fix:**

```bash
bun format
```

### TypeScript Strict Mode Errors

**Symptoms:** `bun typecheck` fails with errors about possibly `null` or `undefined` values.

TypeScript strict mode is enabled. Common patterns:

```typescript
// Wrong: object might be null
const name = user.name

// Correct: null check first
const name = user?.name ?? 'default'
```

**Fix:** Add proper null checks, use optional chaining (`?.`), and nullish coalescing (`??`). Avoid type assertions (`as`) unless absolutely necessary.

## Search Issues

### Search Provider API Errors

**Symptoms:** Search tool fails with 401 or 403 errors. Console shows `Search API error:`.

**Causes:**

- Search provider API key is missing or invalid (`BRAVE_SEARCH_API_KEY` for the default; `TAVILY_API_KEY` or `EXA_API_KEY` for fallbacks)
- API rate limit exceeded on the search provider's end

**Fix:** Verify your search API key is set correctly in `.env.local`. The default provider is Brave (`BRAVE_SEARCH_API_KEY`). If using Tavily, verify at [tavily.com](https://tavily.com); if using Exa, verify at [exa.ai](https://exa.ai).

### `SEARXNG_API_URL` Not Set

**Symptoms:** Advanced search requests fail. Only relevant if you are using SearXNG as a search provider.

The `SEARXNG_API_URL` variable is required only when `SEARCH_API=searxng` or when advanced search depth is configured via `SEARXNG_DEFAULT_DEPTH=advanced`. It is not needed for the default Brave provider.

**Fix:** If not using SearXNG, this can be ignored. If using SearXNG, set:

```
SEARXNG_API_URL=http://localhost:8888
SEARCH_API=searxng
```

### No Search Results

**Symptoms:** Searches return empty results. The chat shows no sources.

**Causes:**

1. **Missing search API key.** `BRAVE_SEARCH_API_KEY` is the primary key for the default provider.
2. **Wrong `SEARCH_API` value.** If set to a provider that is not configured, searches will fail. Valid values: `brave` (default), `tavily`, `exa`, `firecrawl`, `searxng`.
3. **Provider fallback.** The search layer automatically tries configured providers in order. For the default Brave path, the fallback chain is Brave → Tavily → Exa. If all configured providers fail, inspect the chained error messages in the terminal.

**Fix:** Check that `BRAVE_SEARCH_API_KEY` is set. If using an alternative provider, ensure the corresponding API key and `SEARCH_API` variable are correctly configured. See [Search Providers](../architecture/SEARCH-PROVIDERS.md) for provider setup details.

## Database Issues

### Migration Failures

**Symptoms:** `bun run migrate` fails with connection errors or SQL errors.

**Causes:**

- `DATABASE_URL` is wrong or missing
- Local Supabase is not running
- `DATABASE_SSL_DISABLED=true` is not set for local dev
- Port mismatch (should be 44322 for local Supabase)

**Fix:**

```bash

## Getting More Help

- Check the [Environment Reference](../getting-started/ENVIRONMENT.md) for all configuration options
- Review the [Architecture Guide](../architecture/OVERVIEW.md) for system understanding
- Open an issue on GitHub with reproduction steps
```
