# Research Agent

> **Audience:** Architect | Contributor
> **Prerequisites:** [Architecture Overview](OVERVIEW.md)

This page is the navigation hub for the research agent reference. The detailed material is split by pipeline, modes, tools, runtime systems, extension path, and key files.

## Overview

The agent overview and request pipeline are in the pipeline leaf. See [Research Agent Pipeline](RESEARCH-AGENT-PIPELINE.md#overview).

## End-to-End Pipeline

The HTTP-to-SSE flow is in the pipeline leaf. See [Research Agent Pipeline](RESEARCH-AGENT-PIPELINE.md#end-to-end-pipeline).

## The ToolLoopAgent Pattern

ToolLoopAgent configuration and invocation are in the tool-loop leaf. See [Research Agent Tool Loop](RESEARCH-AGENT-TOOL-LOOP.md#the-toolloopagent-pattern).

## Search Modes

Chat mode, research mode, and mode comparison are in the modes leaf. See [Research Agent Modes](RESEARCH-AGENT-MODES.md#search-modes).

## Tool System

Core tools, display tools, and conditional tools are split into dedicated leaves. See [Research Agent Core Tools](RESEARCH-AGENT-CORE-TOOLS.md#tool-system).

## Core Tools

Search, fetch, todo, specialist, and spatial helper tools are in the core tools leaf. See [Research Agent Core Tools](RESEARCH-AGENT-CORE-TOOLS.md#core-tools).

## Display Tools

Manifest-managed display tools and interactive continuations are in the display tools leaf. See [Research Agent Display Tools](RESEARCH-AGENT-DISPLAY-TOOLS.md#display-tools).

## Conditional Tools

Request-context tools, message persistence, and dynamic parts are in the conditional tools leaf. See [Research Agent Conditional Tools](RESEARCH-AGENT-CONDITIONAL-TOOLS.md#conditional-tools).

## Message Persistence Contract

The canonical `messages.ui_message` contract is in the conditional tools leaf. See [Research Agent Conditional Tools](RESEARCH-AGENT-CONDITIONAL-TOOLS.md#message-persistence-contract).

## Dynamic Tool Parts

Dynamic part rendering and fallback behavior are in the conditional tools leaf. See [Research Agent Conditional Tools](RESEARCH-AGENT-CONDITIONAL-TOOLS.md#dynamic-tool-parts).

## Search Providers

Agent-level provider delegation is in the search provider leaf. See [Research Agent Search Providers](RESEARCH-AGENT-SEARCH-PROVIDERS.md#search-providers).

## Model Selection

Model resolution and provider registry details are in the models/context leaf. See [Research Agent Models and Context](RESEARCH-AGENT-MODELS-CONTEXT.md#model-selection).

## Context Window Management

Message pruning and truncation are in the models/context leaf. See [Research Agent Models and Context](RESEARCH-AGENT-MODELS-CONTEXT.md#context-window-management).

## Streaming Integration

SSE integration and auxiliary agents are in the streaming leaf. See [Research Agent Streaming and Auxiliary Agents](RESEARCH-AGENT-STREAMING-AUXILIARY.md#streaming-integration).

## Auxiliary Agents

Title and related-question generation are in the streaming leaf. See [Research Agent Streaming and Auxiliary Agents](RESEARCH-AGENT-STREAMING-AUXILIARY.md#auxiliary-agents).

## Extending the Agent

Tool, prompt, search provider, and AI provider extension steps are in the extension leaf. See [Research Agent Extension](RESEARCH-AGENT-EXTENSION.md#extending-the-agent).

## Key Files

The file map is in a dedicated key-files leaf. See [Research Agent Key Files](RESEARCH-AGENT-FILES.md#key-files).
