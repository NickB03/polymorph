# Architecture Diagram — Mermaid Source

Upload this file (or paste the diagram) to Gemini as a structural reference when generating the visual architecture image.

```mermaid
graph LR
    User["👤 You"]

    subgraph Agent["Polymorph Agent"]
        direction TB
        Orchestrator["Tool Loop\nOrchestrator"]
        Reasoning["Multi-step\nReasoning"]
        Modes["Search / Research /\nBuild"]
        Orchestrator --> Reasoning --> Modes
    end

    subgraph Providers["AI Providers"]
        direction TB
        Gateway["Vercel AI Gateway"]
        Gemini["Gemini"]
        GPT["GPT"]
        Claude["Claude"]
        Grok["Grok"]
        Gateway --> Gemini
        Gateway --> GPT
        Gateway --> Claude
        Gateway --> Grok
    end

    subgraph Search["Web Search"]
        direction TB
        Brave["Brave (default)"]
        Tavily["Tavily (fallback)"]
        Exa["Exa (fallback)"]
        SearXNG["SearXNG (opt-in)"]
        Firecrawl["Firecrawl (opt-in)"]
    end

    subgraph Geo["Spatial Tools"]
        direction TB
        Geocode["geocodeAddress"]
        Directions["getDirections"]
        Isochrone["getIsochrone"]
        StaticMap["getStaticMapImage<br/>Public URL"]
    end

    subgraph MapServices["Map Services"]
        direction TB
        MapTiler["MapTiler"]
        ORS["OpenRouteService"]
    end

    subgraph Response["Streaming Response"]
        direction TB
        GenUI["Generative UI"]
        Tables["Tables"]
        Charts["Charts"]
        GeoMaps["Geo Maps"]
        Timelines["Timelines"]
        Citations["Citations"]
        Canvas["Canvas Artifacts"]
        GenUI --> Tables
        GenUI --> Charts
        GenUI --> GeoMaps
        GenUI --> Timelines
        GenUI --> Citations
        GenUI --> Canvas
    end

    subgraph Data["Persistence"]
        direction TB
        Supabase["Supabase\nPostgreSQL"]
        Phoenix["Phoenix\nObservability"]
    end

    User -->|query| Agent
    Agent -->|model calls| Providers
    Agent -->|search + fetch| Search
    Agent -->|geo helpers| Geo
    Geo -->|tiles, routes, static maps| MapServices
    Agent -->|SSE stream| Response
    Agent -->|persist| Data
    Response -->|render| User
```
