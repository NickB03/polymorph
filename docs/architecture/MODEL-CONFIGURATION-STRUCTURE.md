# Model Configuration Structure

> **Audience:** Contributor | Operator
> **Prerequisites:** [Model Configuration](MODEL-CONFIGURATION.md)

This leaf explains the model config files, schema, and deployment profile selection used by Polymorph.

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
