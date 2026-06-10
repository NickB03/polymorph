# Polymorph Environment Reference

> **Audience:** New Developer | Contributor
> **Prerequisites:** [Quickstart Guide](QUICKSTART.md)

This page is the navigation hub for environment variables. The detailed matrix is split into core, provider, operations, and local setup leaves.

## Required (Day-1 bootstrap)

Required database, AI, and search variables are in the core leaf. See [Environment Core Variables](ENVIRONMENT-CORE.md#required-day-1-bootstrap).

## Core behavior controls

Authentication, anonymous user, SSL, and app URL controls are in the core leaf. See [Environment Core Variables](ENVIRONMENT-CORE.md#core-behavior-controls).

## Cloud deployment controls

Cloud mode and Redis limit controls are in the core leaf. See [Environment Core Variables](ENVIRONMENT-CORE.md#cloud-deployment-controls).

## Authentication (Supabase)

Supabase auth variables are in the core leaf. See [Environment Core Variables](ENVIRONMENT-CORE.md#authentication-supabase).

## Storage (Supabase)

Storage bucket and service-role variables are in the core leaf. See [Environment Core Variables](ENVIRONMENT-CORE.md#storage-supabase).

## Search provider options

Search provider keys and SearXNG tuning variables are in the provider leaf. See [Environment Provider Variables](ENVIRONMENT-PROVIDERS.md#search-provider-options).

## AI provider options (Direct)

Direct AI provider keys are in the provider leaf. See [Environment Provider Variables](ENVIRONMENT-PROVIDERS.md#ai-provider-options-direct).

## Voice / text-to-speech

Voice feature gate and TTS provider variables are in the provider leaf. See [Environment Provider Variables](ENVIRONMENT-PROVIDERS.md#voice--text-to-speech).

## Canvas artifacts

Guest canvas signing variables are in the provider leaf. See [Environment Provider Variables](ENVIRONMENT-PROVIDERS.md#canvas-artifacts).

## Optional platform features

Guest limits, feedback, tracing pointer, diagnostics, and compiler debug flags are in the provider leaf. See [Environment Provider Variables](ENVIRONMENT-PROVIDERS.md#optional-platform-features).

## Map tiles (geo-map Tool UI)

MapTiler and OpenRouteService variables are in the provider leaf. See [Environment Provider Variables](ENVIRONMENT-PROVIDERS.md#map-tiles-geo-map-tool-ui).

## Admin surface

Admin user configuration is in the operations leaf. See [Environment Operations Variables](ENVIRONMENT-OPERATIONS.md#admin-surface).

## Vercel cron jobs

Cron secret requirements are in the operations leaf. See [Environment Operations Variables](ENVIRONMENT-OPERATIONS.md#vercel-cron-jobs).

## Evals cron (Railway `polymorph-evals`)

Railway eval cron defaults and pointers are in the operations leaf. See [Environment Operations Variables](ENVIRONMENT-OPERATIONS.md#evals-cron-railway-polymorph-evals).

## Tracing (Arize Phoenix)

Phoenix tracing variables and production HTTPS enforcement are in the operations leaf. See [Environment Operations Variables](ENVIRONMENT-OPERATIONS.md#tracing-arize-phoenix).

## Troubleshooting research fetches

Extractor rate-limit symptoms are in the operations leaf. See [Environment Operations Variables](ENVIRONMENT-OPERATIONS.md#troubleshooting-research-fetches).

## Local setup workflow

Local setup steps are in the local setup leaf. See [Environment Local Setup](ENVIRONMENT-LOCAL.md#local-setup-workflow).

## Implementation Details

Guest chat and cloud-mode behavior are in the local setup leaf. See [Environment Local Setup](ENVIRONMENT-LOCAL.md#implementation-details).
