# Generative UI Display Contracts

> **Audience:** Architect | Contributor
> **Prerequisites:** [Generative UI](GENERATIVE-UI.md)

This leaf documents mode-specific display tool availability, geo-map rendering, side-effect tools, and shared action fields.

### Mode-specific tool availability

The chat agent registry exposes different tools depending on the resolved agent mode:

| Tool                    | Chat Mode |        Research Mode        |
| ----------------------- | :-------: | :-------------------------: |
| `search`                |    Yes    |             Yes             |
| `fetch`                 |    Yes    |             Yes             |
| `displayPlan`           |    Yes    |             No              |
| `displayTable`          |    Yes    |             Yes             |
| `displayChart`          |    Yes    |             Yes             |
| `displayGeoMap`         |    Yes    |             Yes             |
| `displayCitations`      |    Yes    |             Yes             |
| `displayLinkPreview`    |    Yes    |             Yes             |
| `displayAgentArtifact`  |    Yes    |             Yes             |
| `displayOptionList`     |    Yes    |             Yes             |
| `displayQuestionWizard` |    Yes    |             Yes             |
| `displayCallout`        |    Yes    |             Yes             |
| `displayTimeline`       |    Yes    |             Yes             |
| `todoWrite`             |    No     | Yes (when writer available) |

**Chat mode** (max 20 steps) uses forced optimized search and includes `displayPlan` for step-by-step guides. **Research mode** (max 50 steps) uses full search and enables `todoWrite` for task management when a writer is available.

### Geo-map rendering contract

`displayGeoMap` is the renderer-facing half of the spatial toolchain: it receives a structured payload (`markers[]`, `routes[]`, `polygons[]`, etc.) and renders an interactive map. The helper tools `geocodeAddress`, `getDirections`, and `getIsochrone` prepare data that composes into that payload. `getStaticMapImage` is a parallel output mode — it returns a static PNG URL rather than a `displayGeoMap` payload, so use it when the answer should be a shareable image instead of an interactive card.

- `markers[]` supports default dots, emoji markers, and image-backed icons.
- `routes[]` supports labels, descriptions, hover/always tooltips, stroke colors, dash patterns, opacity, and weight.
- `polygons[]` supports filled regions such as isochrones and boundary overlays.
- `clustering` lets dense point sets collapse into cluster markers.
- `viewport` supports both fit-based framing and explicit center/zoom control.

See [Geo & Spatial Tools](GEO-TOOLS.md) for the full compose-first flow.

### Related: side-effect tools

Display tools are passthrough schemas rendered inline. A separate category of conditionally registered tools (`generateImage`, canvas artifact tools) performs work outside the chat and renders through module-local result adapters that are surfaced by the Tool UI registry. The live `competitorResearch` specialist follows the same dedicated-result pattern. See [Research Agent → Conditional Tools](RESEARCH-AGENT-CONDITIONAL-TOOLS.md#conditional-tools).
