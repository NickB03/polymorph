# Model Configuration

> **Audience:** Contributor | Operator
> **Prerequisites:** [Architecture Overview](OVERVIEW.md)

This page is the navigation hub for model configuration docs. The detailed reference is split into focused leaves so Graphify and humans can retrieve one concern at a time.

## Overview

Model selection sits between the chat route and the chat agent factory. See [Model Configuration Structure](MODEL-CONFIGURATION-STRUCTURE.md#overview).

## Config File Structure

The JSON schema and model object fields live in the structure leaf. See [Model Configuration Structure](MODEL-CONFIGURATION-STRUCTURE.md#config-file-structure).

## Configuration Profiles

Default and cloud profile selection is documented with the loader behavior. See [Model Configuration Structure](MODEL-CONFIGURATION-STRUCTURE.md#configuration-profiles).

## Model Selection Algorithm

Cookie preferences, mode fallback order, and provider fallback behavior live in the selection leaf. See [Model Selection](MODEL-SELECTION.md#model-selection-algorithm).

## Provider Registry

Provider IDs, SDK mappings, and enablement variables live in the provider registry leaf. See [AI Provider Registry](AI-PROVIDER-REGISTRY.md#provider-registry).

## Default Models

The current default assignments and hardcoded fallback are documented with selection behavior. See [Model Selection](MODEL-SELECTION.md#default-models).

## How to Change Models

Operational model edits and provider-specific options live with provider registry guidance. See [AI Provider Registry](AI-PROVIDER-REGISTRY.md#how-to-change-models).

## How to Add a New Provider

The SDK install, registry update, environment, and test checklist live in the provider registry leaf. See [AI Provider Registry](AI-PROVIDER-REGISTRY.md#how-to-add-a-new-provider).
