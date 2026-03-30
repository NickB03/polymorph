# Progress Tracker Bug Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 verified bugs across the progress tracker subsystem found by parallel AI SDK and Tool UI audits.

**Architecture:** Three independent commits targeting: (1) accessibility + animation, (2) referential equality + side effects, (3) UX scroll + perf. Each commit is independently shippable. Two high-severity architectural issues (registry gap, todoWrite session state) are documented but scoped out.

**Tech Stack:** React 19, Vitest + Testing Library, Tailwind CSS v4

---

## File Map

| File                                                       | Changes                                                       | Tasks |
| ---------------------------------------------------------- | ------------------------------------------------------------- | ----- |
| `components/tool-ui/progress-tracker/progress-tracker.tsx` | Fix `motion-safe:` prefix, StepIndicator a11y, receipt layout | 1     |
| `hooks/use-activity-feed.ts`                               | Simplify `shouldUpdateItem`, use `findLast`                   | 2     |
| `hooks/use-activity-feed.test.tsx`                         | Update test for simplified `shouldUpdateItem`                 | 2     |
| `components/canvas/canvas-compile-progress.tsx`            | Replace `useMemo` with `useState`+`useEffect` for `choice`    | 3     |
| `components/activity/activity-panel.tsx`                   | Add scroll-position-aware auto-scroll                         | 4     |

---

### Task 1: Fix accessibility and animation bugs (M1, M6, L1)

**Files:**

- Modify: `components/tool-ui/progress-tracker/progress-tracker.tsx`

- [ ] **Step 1: Fix missing `motion-safe:` prefix on `shimmer-invert` (line 310)**

```diff
- 'motion-safe:shimmer shimmer-invert text-foreground'
+ 'motion-safe:shimmer motion-safe:shimmer-invert text-foreground'
```

This matches the correct pattern already used in `components/tool-ui/plan/plan.tsx:119`.

- [ ] **Step 2: Fix StepIndicator `aria-hidden` on all states (lines 92-139)**

Replace `aria-hidden="true"` with `role="img"` and a status-specific `aria-label` on each variant's outer `<span>`:

**Pending (line 97):**

```diff
-        aria-hidden="true"
+        role="img"
+        aria-label="Pending"
```

**In-progress (line 106):**

```diff
-        aria-hidden="true"
+        role="img"
+        aria-label="In progress"
```

**Completed (line 117):**

```diff
-        aria-hidden="true"
+        role="img"
+        aria-label="Completed"
```

**Failed (line 130):**

```diff
-        aria-hidden="true"
+        role="img"
+        aria-label="Failed"
```

- [ ] **Step 3: Fix receipt summary badge alignment when ElapsedTimeBadge returns null (line 191)**

Add `ml-auto` to the summary span so it always right-aligns regardless of whether ElapsedTimeBadge renders:

```diff
-        <div className="flex items-center justify-between">
+        <div className="flex items-center gap-2">
           <ElapsedTimeBadge elapsedTime={elapsedTime} />
           <span
             className={cn(
+              'ml-auto',
               'flex items-center gap-1.5 text-xs font-medium',
               receiptState.toneClassName
             )}
```

- [ ] **Step 4: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/tool-ui/progress-tracker/progress-tracker.tsx
git commit -m "fix(progress-tracker): accessibility, motion-safe prefix, receipt layout"
```

---

### Task 2: Fix referential equality in `shouldUpdateItem` and array copy (M3, L4)

**Files:**

- Modify: `hooks/use-activity-feed.ts`
- Modify: `hooks/use-activity-feed.test.tsx`

- [ ] **Step 1: Simplify `shouldUpdateItem` to compare only state (lines 32-38)**

The `item.data !== nextData` check is a referential comparison that returns `true` on every streaming chunk (new objects each time). Since `item.state` already captures meaningful transitions (`active` -> `complete`, `active` -> `error`), the data comparison is redundant.

```typescript
function shouldUpdateItem(
  item: ActivityItem | undefined,
  nextState: ActivityItem['state']
) {
  return !item || item.state !== nextState
}
```

- [ ] **Step 2: Update the 4 call sites to drop the third argument**

Each `shouldUpdateItem(existingItems.get(id), itemState, toolPart)` becomes `shouldUpdateItem(existingItems.get(id), itemState)`. Same for the `parsed` variants. These are at approximately lines 122, 143, 167, 196.

- [ ] **Step 3: Replace `[...messages].reverse().find()` with `findLast` (line 84)**

```diff
-    const lastAssistant = [...messages]
-      .reverse()
-      .find(m => m.role === 'assistant')
+    const lastAssistant = messages.findLast(m => m.role === 'assistant')
```

`Array.prototype.findLast` is ES2023 — supported in the project's TypeScript target (all modern browsers and Node 18+).

- [ ] **Step 4: Review existing test coverage**

The test "does not update unchanged activity items on rerender" (`use-activity-feed.test.tsx:237-257`) currently passes because the same `messages` reference is reused. With the simplified `shouldUpdateItem`, this test should still pass since state doesn't change between rerenders. Verify it.

- [ ] **Step 5: Add a test for state-change-driven updates**

Add a test to `use-activity-feed.test.tsx` that verifies `updateItem` IS called when a tool part's state changes (e.g., from `input-available` to `output-available`):

```typescript
it('updates an activity item when its state changes', async () => {
  const activeMessage = [
    {
      id: 'chat-1-assistant',
      role: 'assistant',
      metadata: { searchMode: 'research' },
      parts: [
        {
          type: 'tool-search',
          toolCallId: 'search-1',
          input: { query: 'test' },
          state: 'input-available',
          output: undefined
        }
      ]
    } as UIMessage
  ]

  const { rerender } = renderHook(
    ({ msgs }) => useActivityFeed(msgs, undefined, 'chat-1'),
    { initialProps: { msgs: activeMessage } }
  )

  await waitFor(() => {
    expect(mockActivity.addItem).toHaveBeenCalledTimes(1)
    expect(mockActivityState.items[0].state).toBe('active')
  })

  const completedMessage = [
    {
      id: 'chat-1-assistant',
      role: 'assistant',
      metadata: { searchMode: 'research' },
      parts: [
        {
          type: 'tool-search',
          toolCallId: 'search-1',
          input: { query: 'test' },
          state: 'output-available',
          output: { state: 'complete', results: [] }
        }
      ]
    } as UIMessage
  ]

  rerender({ msgs: completedMessage })

  await waitFor(() => {
    expect(mockActivity.updateItem).toHaveBeenCalledWith('search:search-1', {
      state: 'complete',
      data: expect.objectContaining({ state: 'output-available' })
    })
  })
})
```

- [ ] **Step 6: Run tests**

Run: `bun run test -- hooks/use-activity-feed.test.tsx`
Expected: All tests pass including the new one

- [ ] **Step 7: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add hooks/use-activity-feed.ts hooks/use-activity-feed.test.tsx
git commit -m "fix(activity-feed): simplify shouldUpdateItem, use findLast"
```

---

### Task 3: Fix `useMemo` side effect in canvas compile progress (L2)

**Files:**

- Modify: `components/canvas/canvas-compile-progress.tsx`

- [ ] **Step 1: Replace `useMemo` with `useState` + `useEffect` for `choice` (lines 48-66)**

The current code calls `new Date().toISOString()` inside `useMemo`, which is a side effect. Replace with:

```typescript
const [choice, setChoice] = useState<
  { outcome: 'success' | 'failed'; summary: string; at: string } | undefined
>()

useEffect(() => {
  if (progress.outcome === 'success') {
    setChoice({
      outcome: 'success',
      summary: 'Compiled successfully',
      at: new Date().toISOString()
    })
  } else if (progress.outcome === 'failed') {
    setChoice({
      outcome: 'failed',
      summary: 'Compilation failed',
      at: new Date().toISOString()
    })
  } else {
    setChoice(undefined)
  }
}, [progress.outcome])
```

Remove the `useMemo` import if no longer used. Keep `useEffect` and `useState` (both already imported).

- [ ] **Step 2: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/canvas/canvas-compile-progress.tsx
git commit -m "fix(canvas): replace useMemo side effect with useState+useEffect"
```

---

### Task 4: Add scroll-position-aware auto-scroll to activity panel (L3)

**Files:**

- Modify: `components/activity/activity-panel.tsx`

- [ ] **Step 1: Add scroll position tracking to `ActivityFeedContent` (lines 53-76)**

Replace the current auto-scroll with a scroll-aware version:

```typescript
export function ActivityFeedContent({ items }: { items: ActivityItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isNearBottom = useRef(true)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    isNearBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  useEffect(() => {
    if (isNearBottom.current) {
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
    }
  }, [items.length])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      data-vaul-no-drag
      className="flex-1 overflow-y-auto px-2 py-2"
    >
      {items.length === 0 ? (
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          Activity will appear here during research
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {items.map(item => (
            <ActivityItemRenderer key={item.id} item={item} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
```

Add `useCallback` to the imports from `react` (line 1).

- [ ] **Step 2: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/activity/activity-panel.tsx
git commit -m "fix(activity-panel): only auto-scroll when user is near bottom"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full test suite**

Run: `bun run test`
Expected: All tests pass

- [ ] **Step 2: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: No errors or warnings

---

## Scoped Out (Documented, No Code Changes)

| ID  | Issue                                                                                                                     | Reason                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | ProgressTracker not registered in `components/tool-ui/registry.tsx`                                                       | By design: built for canvas compile, not chat tool rendering. No server-side `displayProgressTracker` tool exists.                                                              |
| H2  | `todoWrite` session state lost on tool-result continuations (`lib/tools/todo.ts:100-129`, `lib/agents/researcher.ts:109`) | Architectural: requires changes to agent instantiation lifecycle. Rendered plan is correct (DB-persisted parts); only live continuation sessions are affected. Separate ticket. |
| M2  | Status enum divergence: Plan uses `in_progress`/`cancelled`, ProgressTracker uses `in-progress`/`failed`                  | Intentional: separate domain models for separate workflows.                                                                                                                     |
| M5  | `hasActiveToolCall` sticky flag in `components/render-message.tsx:46`                                                     | Correct behavior, misleading name. Cosmetic rename optional.                                                                                                                    |
