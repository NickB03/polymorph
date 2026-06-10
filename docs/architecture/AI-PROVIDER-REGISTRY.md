# AI Provider Registry

> **Audience:** Contributor | Operator
> **Prerequisites:** [Model Configuration](MODEL-CONFIGURATION.md)

This leaf covers registered AI providers and the edit path for changing models or adding a provider.

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
