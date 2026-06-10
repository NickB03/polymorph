# Architecture

> **Audience:** Architect | Contributor
> **Prerequisites:** [Quickstart Guide](../getting-started/QUICKSTART.md)

This page is the navigation hub for the architecture overview. The detailed architecture reference is split into focused leaves so Graphify and humans can retrieve one concern at a time.

## Tech Stack

Framework, runtime, database, auth, AI, search, artifacts, testing, tracing, and UI stack details are in the tech-stack leaf. See [Architecture Tech Stack](OVERVIEW-TECH-STACK.md#tech-stack).

## System Overview

Top-level app surfaces, route groups, provider integrations, and key source files are in the system overview leaf. See [Architecture System Overview](OVERVIEW-SYSTEM.md#system-overview).

## Agent Pipeline

The chat request pipeline and agent dispatch flow are in the agent pipeline leaf. See [Architecture Agent Pipeline](OVERVIEW-AGENT-PIPELINE.md#agent-pipeline).

## Tool System

Core tools, spatial helpers, display tools, and availability by agent are in the tool-system leaf. See [Architecture Tool System](OVERVIEW-TOOL-SYSTEM.md#tool-system).

## Streaming Architecture

The high-level SSE stream architecture and stream-path comparison are in the streaming overview leaf. See [Architecture Streaming Overview](OVERVIEW-STREAMING.md#streaming-architecture).

## Database Schema

The Drizzle/Supabase schema, canonical messages, and indexes are in the database leaf. See [Architecture Database Schema](OVERVIEW-DATABASE.md#database-schema).

## Authentication Flow

Supabase auth, client patterns, middleware, and guest mode are in the auth leaf. See [Architecture Authentication Flow](OVERVIEW-AUTHENTICATION.md#authentication-flow).

## Generative UI Component Tree

Message section rendering and display/dynamic tool placement are in the generative UI component-tree leaf. See [Architecture Generative UI Component Tree](OVERVIEW-GENERATIVE-UI.md#generative-ui-component-tree).

## Model Selection

Model selection is documented with tool-state lifecycle behavior. See [Architecture Models and Tool State](OVERVIEW-MODELS-STATE.md#model-selection).

## Tool State Lifecycle

AI SDK tool state transitions and UI rendering by state are in the models/state leaf. See [Architecture Models and Tool State](OVERVIEW-MODELS-STATE.md#tool-state-lifecycle).

## RLS Policy Chain

RLS policies and user context requirements are in the RLS leaf. See [Architecture RLS Policy Chain](OVERVIEW-RLS.md#rls-policy-chain).

## Key File Reference

The architecture source-file map is in the key-file leaf. See [Architecture Key File Reference](OVERVIEW-FILES.md#key-file-reference).
