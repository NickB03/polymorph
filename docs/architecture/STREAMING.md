# Streaming Architecture

> **Audience:** Architect | Contributor
> **Prerequisites:** [Architecture Overview](OVERVIEW.md)

This page is the navigation hub for streaming docs. Stream types, lifecycle phases, message preparation, operations, SSE protocol, and key files live in focused leaves.

## Overview

The streaming rationale and capabilities are in the stream-types leaf. See [Streaming Stream Types](STREAMING-STREAM-TYPES.md#overview).

## Stream Types

Authenticated and ephemeral stream behavior is in the stream-types leaf. See [Streaming Stream Types](STREAMING-STREAM-TYPES.md#stream-types).

## Stream Lifecycle

Request dispatch and agent finalization are split by lifecycle phase. See [Streaming Request Dispatch](STREAMING-REQUEST-DISPATCH.md#1-client-sends-message).

## Mermaid Diagram

The full streaming sequence diagram is in its own leaf. See [Streaming Sequence Diagram](STREAMING-SEQUENCE-DIAGRAM.md#mermaid-diagram).

## Message Preparation

Submit, regenerate, interactive continuation, pruning, and truncation behavior are in the message-preparation leaf. See [Streaming Message Preparation](STREAMING-MESSAGE-PREPARATION.md#message-preparation).

## Smooth Streaming

Text smoothing is documented with operational side effects and errors. See [Streaming Operations](STREAMING-OPERATIONS.md#smooth-streaming).

## Parallel Operations

Title generation, related questions, persistence, and analytics live in the operations leaf. See [Streaming Operations](STREAMING-OPERATIONS.md#parallel-operations).

## Error Handling

Server, timeout, disconnect, persistence, and client error behavior live in the operations leaf. See [Streaming Operations](STREAMING-OPERATIONS.md#error-handling).

## SSE Protocol

Headers, event shapes, client consumption, and portable tool boundaries live in the SSE protocol leaf. See [Streaming SSE Protocol](STREAMING-SSE-PROTOCOL.md#sse-protocol).

## Key Files

The streaming file map is in the SSE protocol leaf. See [Streaming SSE Protocol](STREAMING-SSE-PROTOCOL.md#key-files).
