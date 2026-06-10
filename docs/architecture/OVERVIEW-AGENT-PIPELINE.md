# Architecture Agent Pipeline

> **Audience:** Architect | Contributor
> **Prerequisites:** [Architecture](OVERVIEW.md)

This leaf traces a chat request through auth, model selection, agent selection, streaming, and SSE response creation.

## Agent Pipeline

Every chat request follows a single path through the API route into the streaming infrastructure. The route authenticates the user (or validates guest access), selects a model, and delegates to either the authenticated or ephemeral stream handler. New guest sessions default to the `speed` model tier in the UI, but the backend does not currently hard-reject a guest `quality` cookie.

```mermaid
flowchart TD
    POST["POST /api/chat"]
    Parse["Parse request body<br/>(messages, chatId, trigger)"]
    Auth["getCurrentUserId()"]
    ShareCheck{"Referer is /share/?"}
    GuestCheck{"userId exists?"}
    GuestEnabled{"ENABLE_GUEST_CHAT<br/>= true?"}
    GuestLimit["checkAndEnforceGuestLimit()<br/>(extract IP from x-forwarded-for)"]
    OverallLimit["checkAndEnforceOverallChatLimit()"]
    Cookies["Read cookies<br/>(searchMode, modelType)"]
    SelectModel["selectModel()<br/>(mode + type lookup)"]
    ProviderCheck{"isProviderEnabled()?"}
    StreamBranch{"isGuest?"}
    EphemeralStream["createEphemeralChatStreamResponse()"]
    AuthStream["createChatStreamResponse()"]
    PrepareMsg["prepareMessages()<br/>(load/create chat,<br/>handle regeneration)"]
    CreateAgent["createChatAgent()<br/>(configure tools + mode)"]
    ChatMode["Chat Mode<br/>maxSteps=20<br/>search forced optimized<br/>tools: search, fetch,<br/>displayPlan, displayTable,<br/>displayChart, displayGeoMap,<br/>geocodeAddress, getDirections,<br/>getIsochrone, getStaticMapImage,<br/>displayCitations, displayLinkPreview,<br/>displayAgentArtifact,<br/>displayOptionList,<br/>displayQuestionWizard,<br/>displayCallout, displayTimeline"]
    ResearchMode["Research Mode<br/>maxSteps=50<br/>full search types<br/>tools: search, fetch,<br/>competitorResearch,<br/>displayTable, displayChart,<br/>displayGeoMap,<br/>geocodeAddress, getDirections,<br/>getIsochrone, getStaticMapImage,<br/>displayCitations, displayLinkPreview,<br/>displayAgentArtifact,<br/>displayOptionList,<br/>displayQuestionWizard,<br/>displayCallout, displayTimeline, todoWrite"]
    BuildMode["Build Mode<br/>maxSteps=20<br/>same tools as Chat<br/>+ artifact-intake prompt<br/>(canvas tools registered<br/>conditionally by context)"]
    AgentStream["agent.stream()<br/>+ smoothStream(word)"]
    Parallel["Parallel operations:<br/>title + related questions<br/>+ persistence"]
    SSE["SSE Response to Client"]

    POST --> Parse --> Auth
    Auth --> ShareCheck
    ShareCheck -->|Yes| ForbidShare["403 Forbidden"]
    ShareCheck -->|No| GuestCheck
    GuestCheck -->|No user| GuestEnabled
    GuestEnabled -->|No| Unauth["401 Unauthorized"]
    GuestEnabled -->|Yes| GuestLimit
    GuestLimit --> Cookies
    GuestCheck -->|Has user| OverallLimit
    OverallLimit --> Cookies
    Cookies --> SelectModel
    SelectModel --> ProviderCheck
    ProviderCheck -->|No| ProviderErr["404 Not Found"]
    ProviderCheck -->|Yes| StreamBranch
    StreamBranch -->|Yes| EphemeralStream
    StreamBranch -->|No| AuthStream
    AuthStream --> PrepareMsg
    EphemeralStream --> CreateAgent
    PrepareMsg --> CreateAgent
    CreateAgent -->|searchMode=chat| ChatMode
    CreateAgent -->|searchMode=research| ResearchMode
    CreateAgent -->|userMode=build OR intent=build| BuildMode
    ChatMode --> AgentStream
    ResearchMode --> AgentStream
    BuildMode --> AgentStream
    AgentStream --> Parallel --> SSE
```

Three agents — `search`, `research`, and `build` — share a common factory at [`lib/agents/chat/factory.ts`](../../lib/agents/chat/factory.ts) and a shared toolset at [`lib/agents/chat/toolset.ts`](../../lib/agents/chat/toolset.ts). Each agent declares its own `*_AGENT_ACTIVE_TOOLS` array, system prompt, step limit, and `configureSearchTool` wrapper. [`lib/agents/chat/registry.ts`](../../lib/agents/chat/registry.ts) resolves the active agent and dispatches to the per-agent module.

The agent is selected by [`resolveChatAgentId()`](../../lib/agents/chat/registry.ts): `searchMode === 'research'` routes to the research agent, `userMode === 'build'` (or `intent === 'build'`) routes to the build agent, and everything else routes to the search agent. The search and build agents force `type: 'optimized'` via `wrapSearchToolForChatMode` and run up to 20 steps; the research agent accepts the full search type set, runs up to 50 steps, and gains the `todoWrite` and `competitorResearch` tools. Canvas tools (`createCanvasArtifact`, `updateCanvasArtifact`, `readCanvasArtifact`) and `generateImage` are registered conditionally inside the factory when the matching context is present, regardless of agent.

**Request body fields:**

| Field              | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `messages`         | Full AI SDK v6 `UIMessage[]` history                   |
| `chatId`           | Chat identifier                                        |
| `trigger`          | `submit-message` or `regenerate-message`               |
| `messageId`        | Target message ID (required for `regenerate-message`)  |
| `isNewChat`        | Optimization flag to skip loading existing chat        |
| `guestCanvasToken` | HMAC-signed token for guest canvas artifact continuity |

---
