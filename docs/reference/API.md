# API Reference

> **Audience:** Contributor | Operator
> **Prerequisites:** [Quickstart Guide](../getting-started/QUICKSTART.md)

This page is the navigation hub for API docs. Chat, resource endpoints, auxiliary endpoints, canvas endpoints, evals, rate limits, and error conventions live in focused leaves.

## Request Flow

The request flow diagram is in the chat API leaf. See [Chat API](API-CHAT.md#request-flow).

## Authentication

Authentication and guest behavior are in the chat API leaf. See [Chat API](API-CHAT.md#authentication).

## Endpoints

Endpoint details are split by endpoint family. See [Chat API](API-CHAT.md#post-apichat).

## POST `/api/chat`

The streaming chat endpoint is in the chat API leaf. See [Chat API](API-CHAT.md#post-apichat).

## GET `/api/chats`

Chat listing is in the resource endpoints leaf. See [Resource API Endpoints](API-RESOURCE-ENDPOINTS.md#get-apichats).

## POST `/api/upload`

File uploads are in the resource endpoints leaf. See [Resource API Endpoints](API-RESOURCE-ENDPOINTS.md#post-apiupload).

## POST `/api/feedback`

Feedback updates are in the resource endpoints leaf. See [Resource API Endpoints](API-RESOURCE-ENDPOINTS.md#post-apifeedback).

## POST `/api/advanced-search`

SearXNG advanced search is in the auxiliary endpoints leaf. See [Auxiliary API Endpoints](API-AUXILIARY-ENDPOINTS.md#post-apiadvanced-search).

## GET `/api/suggestions`

Suggestions reads are in the auxiliary endpoints leaf. See [Auxiliary API Endpoints](API-AUXILIARY-ENDPOINTS.md#get-apisuggestions).

## GET `/api/suggestions/refresh`

Suggestions cron refresh is in the auxiliary endpoints leaf. See [Auxiliary API Endpoints](API-AUXILIARY-ENDPOINTS.md#get-apisuggestionsrefresh).

## POST `/api/voice/synthesize`

Voice synthesis is in the auxiliary endpoints leaf. See [Auxiliary API Endpoints](API-AUXILIARY-ENDPOINTS.md#post-apivoicesynthesize).

## GET `/api/health`

Health checks are in the auxiliary endpoints leaf. See [Auxiliary API Endpoints](API-AUXILIARY-ENDPOINTS.md#get-apihealth).

## Canvas Artifact Endpoints

Canvas artifact lifecycle endpoints are in the canvas endpoints leaf. See [Canvas API Endpoints](API-CANVAS-ENDPOINTS.md#canvas-artifact-endpoints).

## GET `/api/canvas-assets/image-proxy`

The canvas image proxy is in the canvas asset endpoints leaf. See [Canvas Asset API Endpoints](API-CANVAS-ASSETS.md#get-apicanvas-assetsimage-proxy).

## POST `/api/evals/run`

Eval replay is in the evals and limits leaf. See [Evals API and Rate Limits](API-EVALS-LIMITS.md#post-apievalsrun).

## Rate Limiting

Cloud rate limits are in the evals and limits leaf. See [Evals API and Rate Limits](API-EVALS-LIMITS.md#rate-limiting).

## Error Response Conventions

Shared status meanings and error-body patterns are in the evals and limits leaf. See [Evals API and Rate Limits](API-EVALS-LIMITS.md#error-response-conventions).
