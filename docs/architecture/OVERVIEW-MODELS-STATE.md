# Architecture Models and Tool State

> **Audience:** Architect | Contributor
> **Prerequisites:** [Architecture](OVERVIEW.md)

This leaf covers model selection and the AI SDK tool-state lifecycle from input streaming to output availability.

## Model Selection

Models are resolved through a layered preference system that considers the user's cookie preferences, the active search mode, and provider availability. New guest UI sessions default to the speed model tier, but the backend uses the same selection path for guest and authenticated requests and honors a valid `modelType` cookie before falling back to configured defaults.

```mermaid
flowchart TD
    Start["selectModel({cookieStore, searchMode})"]
    ReadCookies["Read cookies:<br/>modelType (speed | quality)<br/>searchMode (chat | research)"]
    BuildTypeOrder["Build type preference order<br/>1. Cookie value (if valid)<br/>2. Remaining types"]
    BuildModeOrder["Build mode preference order<br/>1. Requested mode<br/>2. Remaining modes"]

    LoopModes["For each mode in order"]
    LoopTypes["For each type in order"]
    LoadConfig["getModelForModeAndType()<br/>Load from config/models/*.json"]
    ConfigFound{"Model found<br/>in config?"}
    ProviderEnabled{"isProviderEnabled()<br/>API key present?"}
    ReturnModel["Return model"]
    GatewayFallback["Return same OpenRouter<br/>model via gateway"]
    NextCandidate["Try next candidate"]
    DefaultGatewayCheck{"Gateway enabled<br/>for DEFAULT_MODEL?"}
    DefaultGateway["Return DEFAULT_MODEL<br/>via gateway"]
    DefaultModel["Return DEFAULT_MODEL<br/>(DeepSeek V4 Flash via OpenRouter)"]

    subgraph ConfigFiles["Configuration Files"]
        DefaultJSON["default.json<br/>(standard deployment)"]
        CloudJSON["cloud.json<br/>(POLYMORPH_CLOUD_DEPLOYMENT)"]
    end

    subgraph Providers["Provider Registry (lib/utils/registry.ts)"]
        OpenRouter["openrouter<br/>OPENROUTER_API_KEY"]
        Gateway["gateway<br/>AI_GATEWAY_API_KEY"]
        OpenAI["openai<br/>OPENAI_API_KEY"]
        Anthropic["anthropic<br/>ANTHROPIC_API_KEY"]
        Google["google<br/>GOOGLE_GENERATIVE_AI_API_KEY"]
        OpenAICompat["openai-compatible<br/>OPENAI_COMPATIBLE_API_KEY<br/>+ _BASE_URL"]
        Ollama["ollama<br/>OLLAMA_BASE_URL"]
    end

    Start --> ReadCookies --> BuildTypeOrder --> BuildModeOrder
    BuildModeOrder --> LoopModes --> LoopTypes
    LoopTypes --> LoadConfig --> ConfigFound
    ConfigFound -->|No| NextCandidate
    ConfigFound -->|Yes| ProviderEnabled
    ProviderEnabled -->|"No + OpenRouter model<br/>+ Gateway enabled"| GatewayFallback
    ProviderEnabled -->|No otherwise| NextCandidate
    ProviderEnabled -->|Yes| ReturnModel
    NextCandidate --> LoopTypes
    LoopTypes -->|"Exhausted"| LoopModes
    LoopModes -->|"All exhausted"| DefaultGatewayCheck
    DefaultGatewayCheck -->|Yes| DefaultGateway
    DefaultGatewayCheck -->|No| DefaultModel

    LoadConfig -.-> ConfigFiles
    ProviderEnabled -.-> Providers
```

### Default model configuration

From [`config/models/default.json`](../../config/models/default.json):

| Mode              | Type    | Model                        | Provider   |
| ----------------- | ------- | ---------------------------- | ---------- |
| Chat              | Speed   | `deepseek/deepseek-v4-flash` | OpenRouter |
| Chat              | Quality | `deepseek/deepseek-v4-pro`   | OpenRouter |
| Research          | Speed   | `deepseek/deepseek-v4-flash` | OpenRouter |
| Research          | Quality | `deepseek/deepseek-v4-pro`   | OpenRouter |
| Related Questions | --      | `deepseek/deepseek-v4-flash` | OpenRouter |

**Cloud deployment behavior:** The `POLYMORPH_CLOUD_DEPLOYMENT` flag controls config profile selection (uses `cloud.json` instead of `default.json`), rate limiting enforcement, and analytics event tracking.

If an OpenRouter candidate is selected from config but OpenRouter is disabled and Gateway is enabled, `selectModel()` returns the same model ID with `providerId: 'gateway'` before trying later candidates. The hardcoded `DEFAULT_MODEL` uses the same Gateway fallback after all configured candidates are exhausted.

**Source files:** [`lib/utils/model-selection.ts`](../../lib/utils/model-selection.ts), [`lib/utils/registry.ts`](../../lib/utils/registry.ts), [`lib/config/model-types.ts`](../../lib/config/model-types.ts), [`config/models/default.json`](../../config/models/default.json)

---

## Tool State Lifecycle

Each tool invocation progresses through AI SDK tool-part states inside the canonical `UIMessage.parts` array. The search and fetch tools use the `async *execute` generator pattern to yield intermediate states.

```mermaid
stateDiagram-v2
    [*] --> input_streaming: Agent sends tool call
    input_streaming --> input_available: Input fully received

    input_available --> Executing: Tool execute() begins

    state Executing {
        [*] --> YieldIntermediate: yield { state: searching/fetching }
        YieldIntermediate --> Processing: Provider API call
        Processing --> YieldFinal: yield { state: complete, ...results }
    }

    Executing --> output_available: Generator completes
    Executing --> output_error: Error thrown

    output_available --> [*]: Result returned to agent
    output_error --> [*]: Error returned to agent
```

### UI rendering per state

| State              | UI Representation                                        |
| ------------------ | -------------------------------------------------------- |
| `input-streaming`  | Skeleton/shimmer loading animation                       |
| `input-available`  | Shows tool input parameters                              |
| `output-available` | Full result rendered (SearchSection, FetchSection, etc.) |
| `output-error`     | Error message with `tool_error_text`                     |

**Display tools** have a simpler lifecycle — their `execute` function simply returns the input as output, so they transition quickly through `input-streaming` -> `input-available` -> `output-available`.

---
