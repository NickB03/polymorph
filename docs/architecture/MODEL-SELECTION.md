# Model Selection

> **Audience:** Contributor | Operator
> **Prerequisites:** [Model Configuration](MODEL-CONFIGURATION.md)

This leaf documents the runtime model selection algorithm, default assignments, and fallback behavior.

## Model Selection Algorithm

Model selection happens in `selectModel()` at `lib/utils/model-selection.ts`. The algorithm reads user preferences from cookies and resolves a model through a priority cascade with fallbacks.

> For a visual flowchart, see the [Model Selection diagram in OVERVIEW.md](./OVERVIEW.md#model-selection).

### Inputs

| Input        | Source                | Description                                                    |
| ------------ | --------------------- | -------------------------------------------------------------- |
| `searchMode` | Cookie (`searchMode`) | `chat` or `research`. Defaults to `chat` if missing or invalid |
| `modelType`  | Cookie (`modelType`)  | `speed` or `quality`. Determines preference order              |

### Step-by-step process

1. **Read user preference** — The `modelType` cookie is read. If the value is valid (`speed` or `quality`), it becomes the first choice in the type preference order.

2. **Build type preference order** — Starting with the user's preferred type, then appending the remaining valid type. For example, if the cookie says `quality`, the order is `[quality, speed]`. If no valid cookie, the order is `[speed, quality]`.

3. **Build mode preference order** — Starting with the requested search mode, then appending remaining modes. For example, if the requested mode is `research`, the order is `[research, chat]`.

4. **Nested candidate loop** — For each (mode, type) pair:
   - Look up the model from the config via `getModelForModeAndType(mode, type)`
   - Check if the model's provider is enabled via `isProviderEnabled(providerId)`
   - If both succeed, return that model immediately
   - If the model is an OpenRouter model and OpenRouter is disabled while Gateway is enabled, return the same model ID through `providerId: "gateway"` immediately
   - Otherwise, try the next configured candidate

5. **Fallback** — If no configured candidate succeeds (all providers disabled, or config loading fails), try the hardcoded `DEFAULT_MODEL` (DeepSeek V4 Flash) through Gateway when Gateway is enabled. Otherwise, return the raw OpenRouter `DEFAULT_MODEL` as the last-resort configuration, even if OpenRouter is also unavailable.

**Cloud deployment:** The `POLYMORPH_CLOUD_DEPLOYMENT` flag selects the `cloud.json` config profile instead of `default.json`. The legacy `VANA_CLOUD_DEPLOYMENT` alias is also accepted. This does not force a specific model type.

### Full resolution order

For a request with `searchMode=chat` and `modelType=quality`, the candidates are tried in this order:

1. `chat` + `quality` (requested combination); if this is an OpenRouter model and only Gateway is enabled, return the Gateway-routed version
2. `chat` + `speed` (fallback type); same immediate Gateway fallback rule
3. `research` + `quality` (fallback mode); same immediate Gateway fallback rule
4. `research` + `speed` (fallback mode + type); same immediate Gateway fallback rule
5. `DEFAULT_MODEL` (hardcoded DeepSeek V4 Flash); return it through Gateway if Gateway is enabled, otherwise return the raw OpenRouter default

### Example scenarios

**Default local development** — User has `modelType=speed`, `searchMode=chat`. Lookup finds `chat/speed` -> `deepseek/deepseek-v4-flash` via `openrouter`. `OPENROUTER_API_KEY` is set, so the provider is enabled. Result: DeepSeek V4 Flash.

**Quality preference** — User has `modelType=quality`, `searchMode=chat`. Lookup finds `chat/quality` -> `deepseek/deepseek-v4-pro` via `openrouter`. Provider is enabled. Result: DeepSeek V4 Pro.

**Provider unavailable** — User has `modelType=quality` but no OpenRouter key is set. If `AI_GATEWAY_API_KEY` is set, OpenRouter model IDs are retried through Gateway. If neither provider is enabled, the hardcoded `DEFAULT_MODEL` is returned as a last resort (even though its provider may also be unavailable).

---

## Default Models

The current default configuration (`config/models/default.json`):

| Mode                 | Type    | Model             | Provider   |
| -------------------- | ------- | ----------------- | ---------- |
| Chat                 | Speed   | DeepSeek V4 Flash | OpenRouter |
| Chat                 | Quality | DeepSeek V4 Pro   | OpenRouter |
| Research             | Speed   | DeepSeek V4 Flash | OpenRouter |
| Research             | Quality | DeepSeek V4 Pro   | OpenRouter |
| Related Questions    | -       | DeepSeek V4 Flash | OpenRouter |
| Trending Suggestions | -       | DeepSeek V4 Flash | OpenRouter |

The hardcoded `DEFAULT_MODEL` fallback (used when all config models fail):

```typescript
const DEFAULT_MODEL: Model = {
  id: 'deepseek/deepseek-v4-flash',
  name: 'DeepSeek V4 Flash',
  provider: 'DeepSeek',
  providerId: 'openrouter'
}
```

---
