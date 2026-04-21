# Geo Map

Implementation for the `displayGeoMap` Tool UI surface.

The renderer supports markers, styled routes, filled polygons, clustering, fit-target control, and light/dark basemaps.

## Files

- public exports: components/tool-ui/geo-map/index.tsx
- serializable schema + parse helpers: components/tool-ui/geo-map/schema.ts
- public facade component: components/tool-ui/geo-map/geo-map.tsx
- internal Leaflet engine: components/tool-ui/geo-map/geo-map-engine.tsx
- colocated Leaflet shell theme styles: components/tool-ui/geo-map/geo-map-theme.module.css
- icon construction helpers: components/tool-ui/geo-map/geo-map-icons.ts
- popup/tooltip overlay renderer: components/tool-ui/geo-map/geo-map-overlays.tsx

## Companion docs

- architecture walkthrough: docs/architecture/GEO-TOOLS.md
- generative UI contract: docs/architecture/GENERATIVE-UI.md
- agent/tool orchestration: docs/architecture/RESEARCH-AGENT.md

## Quick check

Run this after edits:

```bash
bun run test -- lib/tools/__tests__/display-geo-map.test.ts components/tool-ui/geo-map/__tests__/schema.test.ts components/tool-ui/geo-map/__tests__/schema-mirror.test.ts
```
