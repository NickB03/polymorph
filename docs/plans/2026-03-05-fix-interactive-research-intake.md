# Fix Interactive Research Intake Bugs

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three bugs in the `feat/interactive-research-intake` branch: duplicate option list cards after user selection, unwanted "Related" sections on option list responses, and research plan stopping at 4/7 steps.

**Architecture:** The root cause of all three visible bugs traces to a single core issue: when the server streams a tool-result continuation response, it injects a NEW messageId into the stream's `start` chunk (because `createUIMessageStream` is not given `originalMessages`). The client SDK receives this new ID, changes the in-flight message ID, and pushes a **new** assistant message instead of replacing the existing one. This creates duplicate content and breaks the agent's continuation flow. The fix: pass `originalMessages` to `createUIMessageStream` for tool-result continuations so the server preserves the existing assistant message ID. Then skip `streamRelatedQuestions` for tool-result continuations since they're mid-research, not final answers.

**Tech Stack:** Next.js 16, AI SDK v5 (`ai` + `@ai-sdk/react`), TypeScript, Bun

---

## Bug Summary (from audit)

| Bug | Symptom | Root Cause |
|-----|---------|-----------|
| Duplicate option card | After user selects an option, the confirmed card appears twice | Server sends new messageId in stream → SDK pushes new message instead of replacing existing one |
| "Related" on option cards | Each duplicate card has a "Related" questions section | `streamRelatedQuestions` runs unconditionally, including on tool-result continuations |
| Plan stops at 4/7 | Research plan never completes remaining steps | Duplicate message corrupts continuation state; agent sees fragmented history |

## Key Files Reference

- `lib/streaming/create-chat-stream-response.ts` — creates the UIMessageStream; needs `originalMessages` for continuations
- `lib/streaming/helpers/prepare-tool-result-messages.ts` — reconstructs messages from DB for tool-result continuations
- `lib/streaming/types.ts` — `BaseStreamConfig` interface
- `app/api/chat/route.ts` — API endpoint, passes config to stream creator
- `components/chat.tsx` — client-side `sendAutomaticallyWhen` + `prepareSendMessagesRequest`
- `node_modules/ai/src/ui-message-stream/create-ui-message-stream.ts:137-139` — where server generates new messageId
- `node_modules/ai/src/ui-message-stream/handle-ui-message-stream-finish.ts:43-50` — where `originalMessages` controls ID reuse
- `node_modules/ai/src/ui/chat.ts:666-675` — where client decides `replaceMessage` vs `pushMessage`

---

### Task 1: Skip related questions on tool-result continuations

This is the simplest fix and is independent of the others.

**Files:**
- Modify: `lib/streaming/create-chat-stream-response.ts:216-231`

**Step 1: Add guard around streamRelatedQuestions**

In `lib/streaming/create-chat-stream-response.ts`, the `streamRelatedQuestions` call at line 216 runs unconditionally. Wrap it with a trigger check. The `trigger` variable is already destructured from `config` at line 42.

```typescript
// BEFORE (lines 216-231):
        // Generate related questions
        if (responseMessages && responseMessages.length > 0) {
          // Find the last user message
          const lastUserMessage = [...modelMessages]
            .reverse()
            .find(msg => msg.role === 'user')
          const messagesForQuestions = lastUserMessage
            ? [lastUserMessage, ...responseMessages]
            : responseMessages

          await streamRelatedQuestions(
            writer,
            messagesForQuestions,
            abortSignal,
            parentTraceId
          )
        }

// AFTER:
        // Generate related questions (skip for tool-result continuations — mid-research, not final answer)
        if (trigger !== 'tool-result' && responseMessages && responseMessages.length > 0) {
          // Find the last user message
          const lastUserMessage = [...modelMessages]
            .reverse()
            .find(msg => msg.role === 'user')
          const messagesForQuestions = lastUserMessage
            ? [lastUserMessage, ...responseMessages]
            : responseMessages

          await streamRelatedQuestions(
            writer,
            messagesForQuestions,
            abortSignal,
            parentTraceId
          )
        }
```

**Step 2: Verify the build compiles**

Run: `bun typecheck`
Expected: No new type errors

**Step 3: Commit**

```bash
git add lib/streaming/create-chat-stream-response.ts
git commit -m "fix: skip related questions on tool-result continuations"
```

---

### Task 2: Pass originalMessages to createUIMessageStream for continuations

This is the core fix that resolves the duplicate message issue and the plan stopping.

**Files:**
- Modify: `lib/streaming/create-chat-stream-response.ts:115-263`

**Context — why this works:**

The AI SDK's `createUIMessageStream` accepts an optional `originalMessages` parameter. When provided:
1. `handleUIMessageStreamFinish` (SDK internal) checks if the last original message is `role: 'assistant'`
2. If so, it reuses that message's ID for the `start` chunk instead of generating a new one
3. The client receives the same ID it already has → `replaceMessage` fires instead of `pushMessage`
4. Result: single assistant message, parts appended, no duplication

**Step 1: Build the originalMessages array for tool-result continuations**

The `messagesToModel` variable (line 120) already contains the full UI message array from `prepareToolResultMessages`. We need to pass this to `createUIMessageStream`. However, `createUIMessageStream` expects `UIMessage[]` from the `ai` package, and `messagesToModel` is already that type.

We need to hoist the `messagesToModel` variable out of the `execute` callback so it can also be passed to `createUIMessageStream`. Since `execute` is async and `createUIMessageStream` needs the value synchronously for its options, we restructure slightly: prepare messages BEFORE creating the stream for tool-result continuations.

```typescript
// BEFORE (simplified structure, lines 114-263):
  const stream = createUIMessageStream<UIMessage>({
    execute: async ({ writer }) => {
      try {
        let messagesToModel: UIMessage[]
        if (toolResult) {
          messagesToModel = await prepareToolResultMessages(context, toolResult)
        } else {
          messagesToModel = await prepareMessages(context, message)
        }
        // ... rest of execute
      }
    },
    onError: ...,
    onFinish: ...
  })

// AFTER:
  // For tool-result continuations, prepare messages upfront so we can pass
  // originalMessages to createUIMessageStream (ensures the server reuses the
  // existing assistant message ID instead of generating a new one).
  let prefetchedMessages: UIMessage[] | undefined
  if (toolResult) {
    const prepareStart = performance.now()
    perfLog('prepareToolResultMessages - Invoked')
    prefetchedMessages = await prepareToolResultMessages(context, toolResult)
    perfTime('prepareMessages completed (pre-stream)', prepareStart)
  }

  const stream = createUIMessageStream<UIMessage>({
    // Pass originalMessages for tool-result continuations so the SDK
    // reuses the existing assistant message ID in the stream's start chunk.
    // Without this, the client receives a new ID and pushes a duplicate message.
    ...(prefetchedMessages ? { originalMessages: prefetchedMessages } : {}),
    execute: async ({ writer }) => {
      try {
        const prepareStart = performance.now()
        let messagesToModel: UIMessage[]
        if (prefetchedMessages) {
          messagesToModel = prefetchedMessages
          perfLog('prepareMessages - Using prefetched messages for tool-result')
        } else {
          perfLog(
            `prepareMessages - Invoked: trigger=${trigger}, isNewChat=${isNewChat}`
          )
          messagesToModel = await prepareMessages(context, message)
        }
        perfTime('prepareMessages completed (stream)', prepareStart)
        // ... rest of execute unchanged
```

**Step 2: Verify the build compiles**

Run: `bun typecheck`
Expected: No new type errors

**Step 3: Manual test — verify single message after option selection**

1. Run `bun dev`
2. Start a new chat with an ambiguous query like "best database recommendations"
3. The agent should present a `displayOptionList`
4. Select an option
5. Verify:
   - Only ONE option list card appears (with checkmark) after selection
   - No "Related" section appears on the option list response
   - The agent continues research (streams new content into the SAME assistant message)
   - The research plan progresses past where it previously stopped

**Step 4: Commit**

```bash
git add lib/streaming/create-chat-stream-response.ts
git commit -m "fix: pass originalMessages for tool-result continuations to prevent duplicate messages

The server was injecting a new messageId into the stream start chunk because
createUIMessageStream had no knowledge of the existing assistant message. This
caused the client SDK to push a new message instead of replacing the existing
one, resulting in duplicate option list cards and broken plan continuation.

By passing originalMessages (from prepareToolResultMessages), the SDK reuses
the existing assistant message ID, and the client correctly appends new parts
to the same message."
```

---

### Task 3: Verify plan continuation works end-to-end

This is a manual verification task — no code changes, just confirming the fixes work together.

**Step 1: Test research mode with plan**

1. Set search mode to "Research" in the UI
2. Ask: "best database for web applications"
3. The agent should:
   - Present a `displayOptionList` asking for use case
   - After your selection, continue research immediately
   - Complete ALL steps in the research plan (not stop at 4/7)
   - Present a final answer with citations

**Step 2: Test chat mode with option list**

1. Set search mode to "Chat" (not Research)
2. Ask: "best programming language for beginners"
3. The agent should:
   - Present option list if it deems the query ambiguous
   - After selection, continue with a direct answer
   - No duplicate cards, no spurious "Related" sections

**Step 3: Test that non-option-list flows are unaffected**

1. Ask a clear, specific question: "What is the capital of France?"
2. Verify: Normal response, related questions appear as expected
3. Ask a research question that doesn't trigger option list: "latest news about TypeScript 6.0"
4. Verify: Normal research flow, plan completes, related questions appear

**Step 4: Commit any remaining fixes**

If any issues are found during testing, fix them and commit.

---

### Task 4: Clean up unused code from earlier iterations

The git status shows uncommitted changes to several files that may contain leftover code from earlier approaches. Review and clean up.

**Files to check:**
- `components/chat.tsx` — verify `autoSendFiredRef` approach is clean (no leftover `autoSendReadyAtRef` from earlier delay-based approach)
- `lib/streaming/types.ts` — verify no leftover `messages?: UIMessage[]` field (from the earlier approach that sent full messages from client)
- `app/api/chat/route.ts` — verify no leftover `messages` extraction from body (from earlier approach)

**Step 1: Check for leftover client-side messages passing**

The earlier committed approach sent full `messages` from the client for tool-result continuations. The current approach uses `toolResult` (minimal delta) instead. Verify:
- `BaseStreamConfig` in `lib/streaming/types.ts` should NOT have a `messages` field — it should only have `toolResult`
- `app/api/chat/route.ts` should NOT extract or pass `messages` for tool-result
- `components/chat.tsx` `prepareSendMessagesRequest` for tool-result should only send `toolResult`, not `messages`

**Step 2: Run full checks**

Run: `bun typecheck && bun lint`
Expected: Clean

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: clean up unused code from earlier tool-result approaches"
```
