# Research Agent Modes

> **Audience:** Architect | Contributor
> **Prerequisites:** [Research Agent](RESEARCH-AGENT.md)

This leaf compares chat mode and research mode, including tool availability, prompts, and step limits.

## Search Modes

The agent operates in one of two modes, selected by the user via a cookie preference. Each mode has a distinct system prompt, tool set, step limit, and behavioral philosophy.

### Chat Mode

**Purpose:** Fast, focused answers. Optimized for simple questions that need 1-3 searches.

| Property               | Value                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Max steps              | 20                                                                                  |
| Search type            | Forced `optimized` (via `wrapSearchToolForChatMode` in `lib/agents/chat/search.ts`) |
| Target tool calls      | ~5                                                                                  |
| `todoWrite`            | Not available                                                                       |
| `displayPlan`          | Available                                                                           |
| `displayChart`         | Available                                                                           |
| `displayGeoMap`        | Available                                                                           |
| `displayAgentArtifact` | Available                                                                           |
| Geo helpers            | `geocodeAddress`, `getDirections`, `getIsochrone`, `getStaticMapImage`              |

**How search wrapping works:** In chat mode, the search tool is wrapped by `wrapSearchToolForChatMode()`, which intercepts every call and forces `type: 'optimized'` regardless of what the LLM requests. This ensures the agent always gets content snippets directly from the search provider (Brave by default; Tavily/Exa when selected via `SEARCH_API`) rather than needing to fetch pages separately.

**System prompt behavior:**

- Instructs the agent to complete research within ~5 tool calls
- Defines early stop criteria (sufficient info, converging results, diminishing returns)
- Directs the agent to start with search immediately (no text preamble)
- Prohibits use of fetch on search results (only on user-provided URLs)
- Requires all responses to use inline citations `[number](#toolCallId)`

**Active tools:** `search`, `fetch`, `displayPlan`, `displayTable`, `displayChart`, `displayGeoMap`, `displayCitations`, `displayLinkPreview`, `displayAgentArtifact`, `displayOptionList`, `displayQuestionWizard`, `displayCallout`, `displayTimeline`, `getDirections`, `geocodeAddress`, `getIsochrone`, `getStaticMapImage`

### Research Mode

**Purpose:** Thorough, multi-step research. For complex queries that need systematic investigation.

| Property               | Value                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| Max steps              | 50                                                                     |
| Search type            | Full (general + optimized)                                             |
| Target tool calls      | ~20                                                                    |
| `todoWrite`            | Available (when writer present)                                        |
| `displayChart`         | Available                                                              |
| `displayGeoMap`        | Available                                                              |
| `displayAgentArtifact` | Available                                                              |
| Geo helpers            | `geocodeAddress`, `getDirections`, `getIsochrone`, `getStaticMapImage` |
| `competitorResearch`   | Available for structured market/vendor/company/product comparisons     |
| `displayPlan`          | Not in `activeTools`                                                   |

**System prompt behavior:**

- Assesses query complexity first (simple, medium, complex)
- For 5+ aspects, strongly recommends `todoWrite` for structured planning
- Supports both `type: 'optimized'` (content snippets) and `type: 'general'` (for news, videos, images via Brave)
- Encourages multiple searches from different angles
- Allows fetching top 2-3 sources for deeper content analysis
- Uses `competitorResearch` for structured market, vendor, company, or product comparisons when the user asks for competitor-style analysis

**Active tools:** `search`, `fetch`, `competitorResearch`, `displayTable`, `displayChart`, `displayGeoMap`, `displayCitations`, `displayLinkPreview`, `displayAgentArtifact`, `displayOptionList`, `displayQuestionWizard`, `displayCallout`, `displayTimeline`, `getDirections`, `geocodeAddress`, `getIsochrone`, `getStaticMapImage`, `todoWrite` (conditional)

### Mode Comparison

| Aspect                       | Chat                         | Research                              |
| ---------------------------- | ---------------------------- | ------------------------------------- |
| Step limit                   | 20                           | 50                                    |
| Search types                 | `optimized` only (forced)    | `optimized` + `general`               |
| Task planning                | No (`todoWrite` unavailable) | Yes (`todoWrite` available)           |
| `displayPlan`                | Available                    | Not in active tools                   |
| `competitorResearch`         | Not available                | Available                             |
| `displayGeoMap`              | Available                    | Available                             |
| `displayAgentArtifact`       | Available                    | Available                             |
| Geo helper tools             | Available                    | Available                             |
| Fetch from search results    | Discouraged by prompt        | Encouraged for top sources            |
| Target efficiency            | ~5 tool calls                | ~20 tool calls                        |
| Prompt complexity assessment | No                           | Yes (simple/medium/complex)           |
| Early stop criteria          | 4 criteria                   | 5 criteria (includes todo completion) |

---
