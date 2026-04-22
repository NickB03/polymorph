<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/polymorph-wordmark-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/polymorph-wordmark-light.png">
    <img alt="Polymorph" src="docs/assets/polymorph-wordmark-dark.png" width="320">
  </picture>

  <p>AI platform for research, creation, and exploration.</p>

![CI](https://github.com/NickB03/polymorph/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

<br><br>

<img src="docs/assets/demos/hero.png" alt="Polymorph — AI platform for research, creation, and exploration" width="880">

<p><sub>Ask anything. Research, compare, summarize, explain, or build.</sub></p>

</div>

## See it in action

<table>
  <tr>
    <td width="33%" align="center">
      <img src="docs/assets/demos/research.gif" alt="Polymorph research mode demo" width="100%">
      <br/><b>Research mode</b><br/>
      <sub>Parallel web queries, synthesized answer</sub>
    </td>
    <td width="33%" align="center">
      <img src="docs/assets/demos/geo.gif" alt="Polymorph geo intelligence demo" width="100%">
      <br/><b>Geo intelligence</b><br/>
      <sub>Interactive maps + data tables inline</sub>
    </td>
    <td width="33%" align="center">
      <img src="docs/assets/demos/canvas.gif" alt="Polymorph Canvas artifact demo" width="100%">
      <br/><b>Canvas artifacts</b><br/>
      <sub>Describe a UI, watch it compile live</sub>
    </td>
  </tr>
</table>

## Features

- **Canvas artifacts** — generates and previews single-file React apps with live editing
- **Multi-step research agent** — searches the web, reasons across sources, and synthesizes answers
- **Generative UI** — tables, charts, geo maps, timelines, citations, callouts, and link previews render inline
- **Three conversation modes** — Search, Research, and Build share one chat surface with intent-aware prompting
- **Geo intelligence** — interactive maps, real directions, reachability polygons, and static map images
- **Multi-provider AI** — Gemini and Grok via Vercel AI Gateway, plus direct OpenAI, Anthropic, Google, OpenAI-compatible, and Ollama providers
- **Voice mode** — speech input and text-to-speech playback
- **Guest access** — instant search without sign-up, rate-limited per IP in cloud deployments

## Documentation

[Browse all documentation →](docs/README.md)

- [Quickstart Guide](docs/getting-started/QUICKSTART.md) — local setup, Supabase, auth, and a guided first search
- [Architecture Overview](docs/architecture/OVERVIEW.md) — system design, data flow, tech stack
- [Geo & Spatial Tools](docs/architecture/GEO-TOOLS.md) — geocoding, directions, isochrones, static maps, and `displayGeoMap`
- [Environment Reference](docs/getting-started/ENVIRONMENT.md) — all environment variables
- [Deployment Guide](docs/operations/DEPLOYMENT.md) — Vercel deployment and production config
- [Contributing Guide](CONTRIBUTING.md) — development workflow and quality gates
- [API Reference](docs/reference/API.md) — chat API endpoint and schemas

## Architecture

<details>
<summary>View architecture diagram</summary>

```mermaid
graph LR
    User["👤 You"]

    subgraph Agent["Polymorph Agent"]
        direction TB
        Orchestrator["Tool Loop Orchestrator"]
        Reasoning["Multi-step Reasoning"]
        Modes["Search / Research / Build"]
        Orchestrator --> Reasoning --> Modes
    end

    subgraph Providers["AI Providers"]
        direction TB
        Gateway["Vercel AI Gateway"]
        GatewayModels["Gemini 3 Flash / Grok 4.1 Fast Reasoning"]
        Direct["OpenAI / Anthropic / Google / OpenAI-compatible / Ollama"]
        Gateway --> GatewayModels
    end

    subgraph Search["Web Search"]
        Brave["Brave"]
        Tavily["Tavily"]
        Exa["Exa"]
    end

    subgraph Geo["Spatial Tools"]
        Geocode["geocodeAddress"]
        Directions["getDirections"]
        Isochrone["getIsochrone"]
        StaticMap["getStaticMapImage<br/>Public URL"]
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
        GenUI --> Tables & Charts & GeoMaps & Timelines & Citations & Canvas
    end

    subgraph Data["Persistence"]
        Supabase["Supabase PostgreSQL"]
        Phoenix["Phoenix Observability"]
    end

    User --> Agent
    Agent --> Providers
    Agent --> Search
    Agent --> Geo
    Agent --> Response
    Agent --> Data
```

</details>

## Attribution

Polymorph is derived from [miurla/morphic](https://github.com/miurla/morphic) under the Apache-2.0 license. See [LICENSE](LICENSE) for details.
