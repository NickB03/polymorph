# Model Configuration

> **Audience:** Contributor | Operator
> **Prerequisites:** [Architecture Overview](OVERVIEW.md)

This document explains how Polymorph selects AI models for the chat agent pipeline (search, research, and build agents). It covers the configuration file format, the selection algorithm, provider registry, and how to add new models or providers.

## Table of Contents

- [Overview](#overview)
- [Config File Structure](#config-file-structure)
- [Configuration Profiles](#configuration-profiles)
- [Model Selection Algorithm](#model-selection-algorithm)
- [Provider Registry](#provider-registry)
- [Default Models](#default-models)
- [How to Change Models](#how-to-change-models)
- [How to Add a New Provider](#how-to-add-a-new-provider)

---

## Overview

Model selection sits between the chat API route (`app/api/chat/route.ts`) and the chat agent factory (`lib/agents/chat/factory.ts`, dispatched via `lib/agents/chat/registry.ts`). When a user sends a message, the system determines which language model to use based on two dimensions:

- **Search mode** (`chat` or `research`) — controls the agent's tool budget and research depth
- **Model type** (`speed` or `quality`) — controls the cost/capability trade-off

The resolved model is passed to the chat agent, which uses it for all LLM calls during the tool loop. The selection logic lives in `lib/utils/model-selection.ts` and reads configuration from JSON files in `config/models/`. The same config file also supplies the `relatedQuestions` model used after answers and the `trendingSuggestions` model used by `/api/suggestions/refresh`.

```
User preferences (cookies)
        |
        v
  selectModel()  -->  config/models/{default,cloud}.json
        |                       |
        v                       v
  isProviderEnabled()     getModelForModeAndType()
        |
        v
  lib/utils/registry.ts  (provider availability)
        |
        v
  Resolved Model  -->  Chat Agent (search / research / build)
```

---

## Config File Structure

Model configurations live in `config/models/` as JSON files. Each file follows the `ModelsConfig` schema:

```jsonc
{
  "version": 1,
  "models": {
    "byMode": {
      "chat": {
        "speed": {
          /* Model */
        },
        "quality": {
          /* Model */
        }
      },
      "research": {
        "speed": {
          /* Model */
        },
        "quality": {
          /* Model */
        }
      }
    },
    "relatedQuestions": {
      /* Model */
    },
    "trendingSuggestions": {
      /* Model */
    }
  }
}
```

### Model Object

Each model entry has the following fields:

| Field             | Type      | Description                                                               |
| ----------------- | --------- | ------------------------------------------------------------------------- |
| `id`              | `string`  | Model identifier passed to the provider (e.g., `google/gemini-3-flash`)   |
| `name`            | `string`  | Human-readable display name                                               |
| `provider`        | `string`  | Provider company name (e.g., `Google`, `xAI`)                             |
| `providerId`      | `string`  | Registry key for the AI provider (e.g., `gateway`, `openai`, `anthropic`) |
| `providerOptions` | `object?` | Optional provider-specific options passed to the model                    |

### Dimensions

The config maps two dimensions to a model:

- **Search Mode** (`chat` | `research`): Controls the agent's research strategy
- **Model Type** (`speed` | `quality`): Controls the model's capability tier

This creates a 2x2 matrix of possible model assignments. Separate `relatedQuestions` and `trendingSuggestions` models handle post-response question generation and suggestions refresh, respectively.

**Source:** `lib/types/models.ts` (Model interface), `lib/types/model-type.ts` (ModelType), `lib/types/search.ts` (SearchMode)

---

## Configuration Profiles

Two profiles exist, selected by the cloud deployment flag (`POLYMORPH_CLOUD_DEPLOYMENT` or the legacy `VANA_CLOUD_DEPLOYMENT` alias):

| Profile   | File                         | Selected When                                                     |
| --------- | ---------------------------- | ----------------------------------------------------------------- |
| `default` | `config/models/default.json` | Default (self-hosted)                                             |
| `cloud`   | `config/models/cloud.json`   | `POLYMORPH_CLOUD_DEPLOYMENT=true` or `VANA_CLOUD_DEPLOYMENT=true` |

The config loader at `lib/config/load-models-config.ts`:

1. Determines the active profile from environment variables
2. Loads the corresponding JSON file (statically imported at build time)
3. Validates the structure against the `ModelsConfig` schema (all modes and types must be present)
4. Caches the result (invalidated when the profile changes)

The loader provides both async (`loadModelsConfig`) and sync (`getModelsConfig`) access patterns.

---

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

## Provider Registry

The provider registry at `lib/utils/registry.ts` wraps multiple AI SDK providers into a unified `createProviderRegistry`:

| Provider ID         | SDK                           | Environment Variable                                           | Purpose                                                  |
| ------------------- | ----------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| `openrouter`        | `@openrouter/ai-sdk-provider` | `OPENROUTER_API_KEY`                                           | OpenRouter (default text model provider)                 |
| `gateway`           | `@ai-sdk/gateway`             | `AI_GATEWAY_API_KEY`                                           | Vercel AI Gateway (image generation and optional routes) |
| `openai`            | `@ai-sdk/openai`              | `OPENAI_API_KEY`                                               | OpenAI direct access                                     |
| `anthropic`         | `@ai-sdk/anthropic`           | `ANTHROPIC_API_KEY`                                            | Anthropic direct access                                  |
| `google`            | `@ai-sdk/google`              | `GOOGLE_GENERATIVE_AI_API_KEY`                                 | Google AI direct access                                  |
| `openai-compatible` | `@ai-sdk/openai` (custom)     | `OPENAI_COMPATIBLE_API_KEY` + `OPENAI_COMPATIBLE_API_BASE_URL` | Any OpenAI-compatible API                                |
| `ollama`            | `ollama-ai-provider-v2`       | `OLLAMA_BASE_URL`                                              | Local Ollama models (only registered when URL is set)    |

The `getModel(modelString)` function takes a `providerId:modelId` string and returns a `LanguageModel` from the registry.

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

## How to Change Models

### Using OpenRouter or Gateway Providers

OpenRouter (`providerId: "openrouter"`) is the default text model provider. Vercel AI Gateway (`providerId: "gateway"`) remains available for image generation and optional model routes. For both providers, the model `id` follows the format `vendor/model-name`.

```json
{
  "id": "deepseek/deepseek-v4-flash",
  "name": "DeepSeek V4 Flash",
  "provider": "DeepSeek",
  "providerId": "openrouter"
}
```

### Using a Direct Provider

To use a provider directly (bypassing the Gateway), set the `providerId` to the provider key and use the provider's native model ID:

```json
{
  "id": "claude-sonnet-4-5-20250514",
  "name": "Claude Sonnet 4.5",
  "provider": "Anthropic",
  "providerId": "anthropic"
}
```

Make sure the corresponding API key is set in your environment. See [docs/ENVIRONMENT.md](../getting-started/ENVIRONMENT.md) for the full list of provider variables.

### Testing

After changing a model, verify it works in both search modes:

1. Set the `modelType` cookie to match your config entry (`speed` or `quality`)
2. Set the `searchMode` cookie to `chat`, send a message, and check the server logs for the expected model ID
3. Repeat with `searchMode=research`
4. If targeting `cloud.json`, test with `POLYMORPH_CLOUD_DEPLOYMENT=true` or `VANA_CLOUD_DEPLOYMENT=true`

### Adding Provider Options

Some models accept provider-specific options (e.g., reasoning effort, temperature). Add them via `providerOptions`:

```json
{
  "id": "openai/o3-mini",
  "name": "o3 mini",
  "provider": "OpenAI",
  "providerId": "gateway",
  "providerOptions": {
    "openai": {
      "reasoningEffort": "medium"
    }
  }
}
```

---

## How to Add a New Provider

### 1. Install the SDK

```bash
bun add @ai-sdk/your-provider
```

### 2. Register the Provider

Update `lib/utils/registry.ts`:

```typescript
import { yourProvider } from '@ai-sdk/your-provider'

const providers: Record<string, any> = {
  // ...existing providers
  'your-provider': yourProvider
}
```

### 3. Add Enablement Check

Update `isProviderEnabled()` in the same file:

```typescript
case 'your-provider':
  return !!process.env.YOUR_PROVIDER_API_KEY
```

### 4. Configure a Model

Add the model to your config JSON:

```json
{
  "id": "your-model-id",
  "name": "Your Model Name",
  "provider": "Your Provider",
  "providerId": "your-provider"
}
```

### 5. Set Environment Variable

```
YOUR_PROVIDER_API_KEY=...
```

### 6. Update Environment Documentation

Add the new API key variable to [docs/ENVIRONMENT.md](../getting-started/ENVIRONMENT.md) under the **AI provider options** section.

### 7. Test

1. Set the API key in `.env.local`
2. Verify `isProviderEnabled('your-provider')` returns `true` (check server logs for warnings)
3. Update a config entry to use the new provider
4. Send a chat message and confirm the correct model is used in both `chat` and `research` search modes

The model selection algorithm will automatically include models from the new provider as long as `isProviderEnabled()` returns `true`.
