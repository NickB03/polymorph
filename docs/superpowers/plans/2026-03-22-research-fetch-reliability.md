# Research Fetch Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop source-fetch failures during research by keeping research grounded in Brave, Tavily, and Exa search, reducing unnecessary extractor calls, and making any remaining fetch failures actionable instead of opaque.

**Architecture:** Keep search as the primary evidence path and use the existing multi-provider search stack to prefer Brave first, Tavily second, and Exa third. Narrow the fetch tool so ordinary HTML article pages use direct retrieval or search snippets, while API extraction is reserved for PDFs and explicit hard-extraction cases; when an extractor does fail, propagate the real provider error and expose it in the UI.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vercel AI SDK `ToolLoopAgent`, Brave Search API, Tavily Search + Extract, Vitest

---

## File Map

**Modify**

- `lib/tools/fetch.ts` — fix extractor error handling, add fallback behavior, and narrow when `api` extraction is used
- `lib/tools/__tests__/fetch.test.ts` — add failing tests for Tavily/Jina error propagation and fallback behavior
- `lib/agents/prompts/search-mode-prompts.ts` — remove contradictory fetch guidance and bias the agent toward Brave/Tavily search results over post-search fetches
- `components/fetch-section.tsx` — show actionable fetch error text instead of a generic failure state
- `components/activity/activity-fetch-item.tsx` — expose enough failure context in the activity list to debug provider issues
- `lib/tools/search.ts` — verify and, if needed, tighten provider preference and fallback order around Brave primary and Tavily secondary
- `docs/getting-started/ENVIRONMENT.md` — document the intended Brave/Tavily search configuration and optional extractor behavior

**Create**

- `lib/tools/__tests__/search-provider-routing.test.ts` — focused tests for provider selection and fallback order if existing coverage is too indirect

---

### Task 1: Lock Search Provider Intent to Brave Primary, Tavily Secondary, Exa Tertiary

**Files:**

- Modify: `lib/tools/search.ts`
- Test: `lib/tools/__tests__/search-provider-routing.test.ts`
- Reference: `lib/tools/search/providers/brave.ts`
- Reference: `lib/tools/search/providers/tavily.ts`

- [ ] **Step 1: Write the failing routing tests**

Add cases covering:

- `SEARCH_API=brave` uses Brave first
- Brave failure falls back to Tavily when `TAVILY_API_KEY` is present
- Tavily failure then falls through to Exa when `EXA_API_KEY` is present
- Tavily can remain the primary only when explicitly configured
- Missing Brave key with `SEARCH_API=brave` still reaches the next available provider cleanly

```ts
it('falls back from Brave to Tavily to Exa for web research', async () => {
  process.env.SEARCH_API = 'brave'
  process.env.BRAVE_SEARCH_API_KEY = 'brave-key'
  process.env.TAVILY_API_KEY = 'tavily-key'
  process.env.EXA_API_KEY = 'exa-key'

  mockBraveSearch.mockRejectedValueOnce(new Error('Brave web API error 500'))
  mockTavilySearch.mockRejectedValueOnce(new Error('Tavily API error 500'))
  mockExaSearch.mockResolvedValueOnce({
    results: [{ title: 'Fallback result', url: 'https://example.com' }],
    images: [],
    query: 'sleep deprivation memory',
    number_of_results: 1
  })

  const chunks = await collectSearchChunks({
    query: 'sleep deprivation memory'
  })

  expect(chunks.at(-1)?.results?.[0]?.title).toBe('Fallback result')
})
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `bun run test -- lib/tools/__tests__/search-provider-routing.test.ts`

Expected: FAIL because the new routing assertions are not covered yet.

- [ ] **Step 3: Implement the minimal routing cleanup**

Make the provider path explicit in `lib/tools/search.ts`:

- prefer `SEARCH_API=brave` for research unless a different provider is intentionally configured
- keep Tavily as the first text-rich fallback when Brave fails
- use Exa as the third provider for text-only semantic fallback
- keep fallback messaging precise so logs show which providers failed and in what order

- [ ] **Step 4: Re-run the targeted routing tests**

Run: `bun run test -- lib/tools/__tests__/search-provider-routing.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tools/search.ts lib/tools/__tests__/search-provider-routing.test.ts
git commit -m "fix: add exa as tertiary search fallback"
```

---

### Task 2: Fix Fetch API Error Handling and Add Safe HTML Fallbacks

**Files:**

- Modify: `lib/tools/fetch.ts`
- Test: `lib/tools/__tests__/fetch.test.ts`

- [ ] **Step 1: Write failing fetch tests for extractor failures**

Add cases for:

- Tavily extract returns non-OK response with JSON error body
- Tavily extract returns empty `results`
- `type: 'api'` on an HTML page can fall back to regular fetch when extraction fails for quota/rate-limit/provider reasons
- PDFs still do not fall back to regular HTML fetch

```ts
it('surfaces Tavily extract quota errors', async () => {
  process.env.TAVILY_API_KEY = 'test-tavily-key'
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 432,
    statusText: 'Request Failed',
    text: () =>
      Promise.resolve(
        JSON.stringify({
          detail: { error: 'Plan usage limit exceeded' }
        })
      )
  })

  await expect(
    collectStreamResults({
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11494604/',
      type: 'api'
    })
  ).rejects.toThrow('Tavily extract error 432')
})
```

- [ ] **Step 2: Run the fetch test file to verify it fails**

Run: `bun run test -- lib/tools/__tests__/fetch.test.ts`

Expected: FAIL because `fetchTavilyExtractData()` currently ignores `response.ok` and throws the generic “No results returned...” message.

- [ ] **Step 3: Implement minimal extractor hardening**

In `lib/tools/fetch.ts`:

- check `response.ok` before reading Tavily/Jina success payloads
- include provider status code and message in thrown errors
- detect extract failures that are safe to recover from on HTML pages
- when `type: 'api'` fails for a non-PDF HTML URL, retry once with `fetchRegularData()`
- keep explicit failures for true PDF/extractor-only paths

Suggested shape:

```ts
if (!response.ok) {
  const body = await response.text().catch(() => '')
  throw new Error(
    `Tavily extract error ${response.status}: ${extractProviderMessage(body)}`
  )
}
```

```ts
if (type === 'api') {
  try {
    results = await fetchTavilyExtractData(url, context?.abortSignal)
  } catch (error) {
    if (isRecoverableHtmlExtractFailure(url, error)) {
      results = await fetchRegularData(url, context?.abortSignal)
    } else {
      throw error
    }
  }
}
```

- [ ] **Step 4: Re-run the fetch tests**

Run: `bun run test -- lib/tools/__tests__/fetch.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tools/fetch.ts lib/tools/__tests__/fetch.test.ts
git commit -m "fix: harden research fetch extraction errors"
```

---

### Task 3: Align Agent Prompting with the Intended Research Flow

**Files:**

- Modify: `lib/agents/prompts/search-mode-prompts.ts`

- [ ] **Step 1: Add a prompt fixture test or snapshot if prompt tests already exist**

If there is already prompt coverage, extend it. Otherwise, document the exact required behavior in comments near the changed prompt sections:

- research starts with search
- Brave/Tavily search results are usually enough
- fetch is reserved for user-provided URLs, PDFs, and explicit extraction needs
- normal search-result articles should not default to `type: 'api'`

- [ ] **Step 2: Verify the current contradiction in the prompt**

Inspect and reconcile these two positions:

- “ONLY use fetch when a URL is directly provided by the user”
- “Search → Identify top sources → Fetch if needed”

Expected: one clear rule set, not both.

- [ ] **Step 3: Rewrite the fetch guidance**

Update `lib/agents/prompts/search-mode-prompts.ts` so the model follows this order:

1. Search with Brave/Tavily/Exa before considering fetch
2. Answer from snippets/citations when sufficient
3. Fetch only if the user supplied a URL, the result is a PDF, or the snippet is clearly insufficient
4. Prefer `regular` for normal web pages
5. Use `api` only for PDFs or extractor-specific needs

- [ ] **Step 4: Smoke-test the agent behavior**

Run the app and reproduce a research query similar to the failing one:
`sleep deprivation effects working memory episodic procedural memory`

Expected:

- search runs first
- fewer fetch calls
- no burst of `type: 'api'` fetches for normal article pages

- [ ] **Step 5: Commit**

```bash
git add lib/agents/prompts/search-mode-prompts.ts
git commit -m "fix: reduce unnecessary research fetch calls"
```

---

### Task 4: Make Failures Visible in the UI

**Files:**

- Modify: `components/fetch-section.tsx`
- Modify: `components/activity/activity-fetch-item.tsx`

- [ ] **Step 1: Write UI tests if these components already have nearby test patterns**

Cover:

- provider error text rendered in the fetch section
- activity row exposes a tooltip, title, or inline text for failed fetches
- successful rows still remain compact

- [ ] **Step 2: Run the relevant tests or create a focused manual verification checklist**

If no component tests exist, use manual verification:

- failed fetch shows source domain
- failure text includes real provider message
- success rows remain visually unchanged

- [ ] **Step 3: Implement the smallest UX improvement**

Examples:

- render `tool.errorText` in `FetchSection`
- add `title={tool.errorText}` or a compact inline label in `ActivityFetchItem`
- preserve the current red icon but stop hiding the cause

- [ ] **Step 4: Manually verify in the browser**

Use the same failing research flow and confirm the UI shows something like:

- `Tavily extract error 432: plan usage limit exceeded`

- [ ] **Step 5: Commit**

```bash
git add components/fetch-section.tsx components/activity/activity-fetch-item.tsx
git commit -m "feat: surface research fetch provider errors"
```

---

### Task 5: Document the Supported Provider Setup

**Files:**

- Modify: `docs/getting-started/ENVIRONMENT.md`

- [ ] **Step 1: Add environment guidance for research providers**

Document:

- `BRAVE_SEARCH_API_KEY` for primary search
- `TAVILY_API_KEY` for secondary search and optional extract
- `EXA_API_KEY` for tertiary text-search fallback
- `JINA_API_KEY` is optional, not required for the default setup
- when `api` fetch is expected to be used

- [ ] **Step 2: Add a short troubleshooting note**

Include:

- extractor quota or rate-limit symptoms
- how those appear in the UI after Task 4
- why normal article research should still succeed through Brave/Tavily search even if extract is degraded

- [ ] **Step 3: Commit**

```bash
git add docs/getting-started/ENVIRONMENT.md
git commit -m "docs: clarify brave tavily research configuration"
```

---

### Task 6: Full Verification

**Files:**

- Modify: none
- Verify: repository-wide checks and browser behavior

- [ ] **Step 1: Run focused automated tests**

Run:

- `bun run test -- lib/tools/__tests__/fetch.test.ts`
- `bun run test -- lib/tools/__tests__/search-provider-routing.test.ts`

Expected: PASS.

- [ ] **Step 2: Run repo quality gates**

Run:

- `bun lint`
- `bun typecheck`

Expected: PASS with no warnings or errors.

- [ ] **Step 3: Run manual research smoke tests**

Verify:

- a normal research query uses Brave/Tavily search successfully
- if Brave and Tavily fail, Exa can still produce text search results
- research can complete even when extract is unavailable
- ordinary HTML sources do not fail just because Tavily extract is rate-limited
- fetch errors, when they happen, show actionable provider text

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "fix: stabilize research source retrieval"
```
