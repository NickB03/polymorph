# Polymorph Documentation

## Where to Start

| I want to...                    | Start here                                              |
| ------------------------------- | ------------------------------------------------------- |
| Set up the project from scratch | [Quickstart Guide](getting-started/QUICKSTART.md)       |
| Understand how the system works | [Architecture Overview](architecture/OVERVIEW.md)       |
| Configure environment variables | [Environment Reference](getting-started/ENVIRONMENT.md) |
| Look up API endpoints           | [API Reference](reference/API.md)                       |
| Deploy to production            | [Deployment Guide](operations/DEPLOYMENT.md)            |
| Debug a problem                 | [Troubleshooting](operations/TROUBLESHOOTING.md)        |
| Add a new tool or feature       | [Contributing Guide](../CONTRIBUTING.md)                |

---

## Getting Started

Tutorials and setup guides for new developers.

- [Quickstart Guide](getting-started/QUICKSTART.md) -- End-to-end setup from clone to first search
- [Environment Reference](getting-started/ENVIRONMENT.md) -- All environment variables explained
- [Configuration Guide](getting-started/CONFIGURATION.md) -- Auth modes, search providers, AI providers

## Architecture

Deep dives into how Polymorph works internally.

- [Architecture Overview](architecture/OVERVIEW.md) -- System design, data flow, and component relationships
- [Research Agent](architecture/RESEARCH-AGENT.md) -- ToolLoopAgent orchestration, search modes, and tool pipeline
- [Generative UI](architecture/GENERATIVE-UI.md) -- Display tools, message parts, and rich interactive components
- [Streaming](architecture/STREAMING.md) -- SSE response creation and message part streaming
- [Model Configuration](architecture/MODEL-CONFIGURATION.md) -- Model selection logic, provider registry, and config files
- [Search Providers](architecture/SEARCH-PROVIDERS.md) -- Tavily, Brave, Exa, SearXNG, and Firecrawl integration
- [Launch Decisions](architecture/DECISIONS.md) -- ADRs capturing Phase 0 architecture choices

## Reference

Lookup material for day-to-day development.

- [API Reference](reference/API.md) -- Chat API endpoint, request/response schemas, error codes
- [File Index](reference/FILE-INDEX.md) -- Every file in the repository with a one-line description

## Operations

Deployment, infrastructure, and troubleshooting.

- [Deployment Guide](operations/DEPLOYMENT.md) -- Vercel deployment and production configuration
- [Docker Guide](operations/DOCKER.md) -- Containerized setup with Docker Compose
- [Troubleshooting](operations/TROUBLESHOOTING.md) -- Common issues, error messages, and fixes
- [Day-2 Operations Runbook](operations/runbooks/day-2-operations.md) -- Monitoring, maintenance, and incident response
