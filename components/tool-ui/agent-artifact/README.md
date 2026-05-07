# Agent Artifact Community Port

- Upstream project: Agent Kit / agents-ui artifact UI
- Upstream source URL: https://github.com/agents-ui/agents-kit
- Upstream commit: `03c55476a3e03a4f7ac90211f00a6a6d19706dac`
- Upstream file: `components/agents-ui/agent-artifact.tsx` (`c2e6265ed9ed2c219499c6a70ffa9e886e57e58d`)
- Upstream docs file: `app/docs/agent-artifact/page.mdx` (`e44d7184fa1e69e655fe32e659e46fe1776804bf`)
- Upstream license file: `LICENSE.md` (`3c9d400a8904c040338ec6bbc982fd21b759765b`)
- Source type: ported local component, not npm package consumption.
- Upstream license: non-commercial; personal and internal evaluation allowed, commercial use requires permission. The project owner clarified Polymorph is personal/non-commercial.
- Upstream notice retained: Copyright (c) 2025 Abhishek Gahlot. The exact upstream permission notice is preserved in `UPSTREAM-LICENSE.md` for this adapted port.
- Upstream runtime adopted: none. Polymorph keeps its local AI SDK v6 chat runtime and bespoke Tool UI renderer.
- Dependencies adopted: existing React, `lucide-react`, local shadcn `Button`, and local `cn` utility through `./_adapter`.
- Files copied as-is: none for this v1.
- Files adapted: artifact behavior contract only: title, artifact type, content, versions, active version, metadata, tabs, copy action, and download-friendly content.
- Adapter files: `components/tool-ui/agent-artifact/_adapter.tsx` re-exports local `Button` and `cn` for the ported component.
- Local runtime deviations: renders through `components/tool-ui/renderer-catalog.tsx`, uses `ToolCardMount` and `ToolErrorBoundary`, and is model-exposed through `lib/tools/display-agent-artifact/*`.
- Future npm path: if Agent Kit or another AI SDK-standardized package exposes an equivalent public npm component, prefer `sourceType: 'npm'`, import that public export, and keep only Polymorph mapping in local adapter files.
