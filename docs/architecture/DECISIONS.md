# Architecture Decisions

> **Audience:** Architect | Contributor

Date: 2026-02-23

This document records the foundational architecture decisions for Polymorph.

## 1) Authentication and Backend

- **Provider**: Supabase
- **Local Dev**: Supabase CLI (Docker-based local backend)
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication mode**: `ENABLE_AUTH=true` by default; can be disabled with `ENABLE_AUTH=false` (not allowed in cloud deployment mode)

## 2) Search and Content Extraction

- **Primary Search**: Tavily (`TAVILY_API_KEY`)
- **Multimedia Search**: Brave (`BRAVE_SEARCH_API_KEY`)
- **Additional Providers**: Exa, SearXNG (self-hosted), Firecrawl (selectable via `SEARCH_API` env var)
- **Extraction**: Tavily Extract (default), Jina Reader (fallback)

## 3) AI Model Orchestration

- **Primary Interface**: Vercel AI Gateway (`AI_GATEWAY_API_KEY`)
- **Default Models**: Gemini 3 Flash (Speed), Grok 4.1 Fast Reasoning (Quality)

## 4) Storage Strategy

- **Provider**: Supabase Storage
- **Bucket**: `user-uploads` (Public/RLS-protected)

## 5) Deployment Target

- **Primary**: Vercel
- **Secondary**: Docker (containerized app + local Redis)
