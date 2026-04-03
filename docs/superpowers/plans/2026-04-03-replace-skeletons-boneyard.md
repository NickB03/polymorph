# Replace Skeletons with Boneyard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-crafted skeleton loading placeholders with boneyard-js auto-generated skeleton bones that mirror actual DOM layouts.

**Architecture:** Install `boneyard-js` and wrap content areas with its `<Skeleton>` component. The library generates pixel-perfect skeleton bones from real DOM measurements via a CLI build step. Keep a simple `SkeletonBlock` shimmer div for atomic placeholder use (sidebar items). Add a `boneyard:build` script that uses Playwright to snapshot all `[data-boneyard]` elements and generate a bone registry.

**Tech Stack:** boneyard-js, React 19, Next.js 16 App Router, Tailwind CSS v4

---

## File Structure

| File                                           | Action    | Responsibility                                                                         |
| ---------------------------------------------- | --------- | -------------------------------------------------------------------------------------- |
| `components/ui/skeleton.tsx`                   | Modify    | Export `SkeletonBlock` (old shimmer div) + re-export boneyard `Skeleton`               |
| `components/default-skeleton.tsx`              | Modify    | Rewrite `DefaultSkeleton` and `SearchSkeleton` using boneyard `Skeleton` with fallback |
| `components/chat-messages.tsx`                 | Modify    | Wrap loading state with boneyard `Skeleton`                                            |
| `components/related-questions.tsx`             | Modify    | Wrap loading/streaming states with boneyard `Skeleton`                                 |
| `components/reasoning-section.tsx`             | Modify    | Replace `DefaultSkeleton` usage with boneyard `Skeleton` wrapper                       |
| `components/research-plan.tsx`                 | Modify    | Replace inline `skeleton-shimmer` with boneyard `Skeleton` wrapper                     |
| `components/search-section.tsx`                | Modify    | Update `SearchSkeleton` import (no API change needed)                                  |
| `components/sidebar/chat-history-skeleton.tsx` | Modify    | Update import from `Skeleton` → `SkeletonBlock`                                        |
| `components/ui/sidebar.tsx`                    | Modify    | Update import from `Skeleton` → `SkeletonBlock`                                        |
| `app/layout.tsx`                               | Modify    | Add boneyard registry import                                                           |
| `app/search/loading.tsx`                       | No change | Already uses `DefaultSkeleton` which gets updated                                      |
| `package.json`                                 | Modify    | Add `boneyard-js` dependency + `boneyard:build` script                                 |
| `.gitignore`                                   | Modify    | Add `public/bones/` (generated output)                                                 |

---

## Chunk 1: Foundation

### Task 1: Install boneyard-js and create branch

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b claude/replace-skeletons-boneyard-i5LLr
```

- [ ] **Step 2: Install boneyard-js**

```bash
bun add boneyard-js
```

- [ ] **Step 3: Add build script to package.json**

Add to `"scripts"`:

```json
"boneyard:build": "npx boneyard-js build --out ./public/bones"
```

- [ ] **Step 4: Add generated bones to .gitignore**

Append to `.gitignore`:

```
# Boneyard generated bones
public/bones/
```

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock .gitignore
git commit -m "feat: install boneyard-js for auto-generated skeleton loading"
```

### Task 2: Refactor skeleton.tsx to export both SkeletonBlock and boneyard Skeleton

**Files:**

- Modify: `components/ui/skeleton.tsx`

- [ ] **Step 1: Rewrite skeleton.tsx**

```tsx
import { Skeleton } from 'boneyard-js/react'

import { cn } from '@/lib/utils/index'

function SkeletonBlock({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('skeleton-shimmer rounded-md', className)} {...props} />
  )
}

export { Skeleton, SkeletonBlock }
```

This preserves the old shimmer div as `SkeletonBlock` for atomic use cases (sidebar items) while making boneyard's `Skeleton` the primary export.

- [ ] **Step 2: Commit**

```bash
git add components/ui/skeleton.tsx
git commit -m "refactor: export SkeletonBlock and boneyard Skeleton from skeleton.tsx"
```

### Task 3: Add boneyard registry import to root layout

**Files:**

- Modify: `app/layout.tsx`

- [ ] **Step 1: Add conditional registry import**

Add after the `./globals.css` import at the top of `app/layout.tsx`:

```tsx
// Boneyard auto-generated skeleton bones registry
try {
  require('../public/bones/registry')
} catch {}
```

Note: The `try/catch` ensures the app works before the first `boneyard:build` run. Once generated, the registry populates all `<Skeleton name="...">` components with their bone data.

**Alternative (if ESM-only):** Use a dynamic import in a client component wrapper instead. Check if the build works with the `require` approach first.

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add boneyard registry import to root layout"
```

---

## Chunk 2: Update Sidebar Skeletons (SkeletonBlock consumers)

### Task 4: Update SidebarMenuSkeleton to use SkeletonBlock

**Files:**

- Modify: `components/ui/sidebar.tsx:687-721`

- [ ] **Step 1: Update import**

Change:

```tsx
import { Skeleton } from '@/components/ui/skeleton'
```

To:

```tsx
import { SkeletonBlock } from '@/components/ui/skeleton'
```

- [ ] **Step 2: Update usages in SidebarMenuSkeleton**

Replace all `<Skeleton` with `<SkeletonBlock` inside the `SidebarMenuSkeleton` component (lines ~704 and ~709).

- [ ] **Step 3: Verify ChatHistorySkeleton still works**

`components/sidebar/chat-history-skeleton.tsx` imports `SidebarMenuSkeleton` — no change needed there since the API is the same.

- [ ] **Step 4: Run typecheck**

```bash
bun typecheck
```

- [ ] **Step 5: Commit**

```bash
git add components/ui/sidebar.tsx
git commit -m "refactor: update SidebarMenuSkeleton to use SkeletonBlock"
```

---

## Chunk 3: Replace Content Skeletons with Boneyard

### Task 5: Rewrite default-skeleton.tsx with boneyard

**Files:**

- Modify: `components/default-skeleton.tsx`

- [ ] **Step 1: Rewrite DefaultSkeleton and SearchSkeleton**

```tsx
'use client'

import { Skeleton } from '@/components/ui/skeleton'

import { SkeletonBlock } from './ui/skeleton'

export function DefaultSkeleton() {
  return (
    <Skeleton
      name="default-loading"
      loading
      fallback={
        <div className="flex flex-col gap-2 pb-4 pt-2">
          {[...Array(2)].map((_, index) => (
            <SkeletonBlock key={index} className="h-6 w-full" />
          ))}
        </div>
      }
    />
  )
}

export function SearchSkeleton() {
  return (
    <Skeleton
      name="search-loading"
      loading
      fallback={
        <div className="flex flex-wrap gap-2 pb-0.5">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="w-[calc(50%-0.5rem)] md:w-[calc(25%-0.5rem)]"
            >
              <SkeletonBlock
                className="h-20 w-full"
                style={{ animationDelay: `${index * 100}ms` }}
              />
            </div>
          ))}
        </div>
      }
    />
  )
}
```

The `fallback` prop renders when `loading=true` but no bones are registered yet (before `boneyard:build` runs). Once bones are generated, boneyard's auto-layout replaces the fallback.

- [ ] **Step 2: Run typecheck**

```bash
bun typecheck
```

- [ ] **Step 3: Commit**

```bash
git add components/default-skeleton.tsx
git commit -m "refactor: rewrite DefaultSkeleton and SearchSkeleton with boneyard"
```

### Task 6: Update chat-messages.tsx loading skeleton

**Files:**

- Modify: `components/chat-messages.tsx:21,245-255`

- [ ] **Step 1: Update import**

Change:

```tsx
import { Skeleton } from './ui/skeleton'
```

To:

```tsx
import { Skeleton, SkeletonBlock } from './ui/skeleton'
```

- [ ] **Step 2: Wrap loading state with boneyard Skeleton**

Replace lines 245-255:

```tsx
<div className="flex flex-col gap-3 py-2">
  <Skeleton className="h-5 w-3/4" />
  <Skeleton className="h-5 w-full" style={{ animationDelay: '75ms' }} />
  <Skeleton className="h-5 w-5/6" style={{ animationDelay: '150ms' }} />
</div>
```

With:

```tsx
<Skeleton
  name="chat-loading"
  loading
  fallback={
    <div className="flex flex-col gap-3 py-2">
      <SkeletonBlock className="h-5 w-3/4" />
      <SkeletonBlock
        className="h-5 w-full"
        style={{ animationDelay: '75ms' }}
      />
      <SkeletonBlock
        className="h-5 w-5/6"
        style={{ animationDelay: '150ms' }}
      />
    </div>
  }
/>
```

- [ ] **Step 3: Commit**

```bash
git add components/chat-messages.tsx
git commit -m "refactor: replace chat loading skeleton with boneyard"
```

### Task 7: Update related-questions.tsx skeletons

**Files:**

- Modify: `components/related-questions.tsx:10,55-77`

- [ ] **Step 1: Update import**

Change:

```tsx
import { Skeleton } from './ui/skeleton'
```

To:

```tsx
import { SkeletonBlock } from './ui/skeleton'
```

- [ ] **Step 2: Replace Skeleton with SkeletonBlock in both loading states**

Replace all `<Skeleton className="h-6 w-full" />` with `<SkeletonBlock className="h-6 w-full" />` (lines ~63 and ~74). These are inline placeholder blocks inside a list — they're the `SkeletonBlock` pattern, not content wrappers.

- [ ] **Step 3: Commit**

```bash
git add components/related-questions.tsx
git commit -m "refactor: update related-questions skeletons to SkeletonBlock"
```

### Task 8: Update reasoning-section.tsx

**Files:**

- Modify: `components/reasoning-section.tsx:8,99`

No change needed beyond the import — it uses `DefaultSkeleton` which was already updated in Task 5. Verify the import path is correct.

- [ ] **Step 1: Verify import**

Confirm line 8 is:

```tsx
import { DefaultSkeleton } from './default-skeleton'
```

This is unchanged — `DefaultSkeleton` now internally uses boneyard.

- [ ] **Step 2: Run typecheck to confirm**

```bash
bun typecheck
```

### Task 9: Update research-plan.tsx

**Files:**

- Modify: `components/research-plan.tsx:59-66`

- [ ] **Step 1: Add import and replace inline shimmer**

Add import:

```tsx
import { Skeleton, SkeletonBlock } from './ui/skeleton'
```

Replace:

```tsx
<div
  className="h-24 skeleton-shimmer rounded-lg"
  role="status"
  aria-label="Loading research plan"
/>
```

With:

```tsx
<Skeleton
  name="research-plan-loading"
  loading
  fallback={
    <SkeletonBlock
      className="h-24 rounded-lg"
      role="status"
      aria-label="Loading research plan"
    />
  }
/>
```

- [ ] **Step 2: Commit**

```bash
git add components/research-plan.tsx
git commit -m "refactor: replace research-plan skeleton-shimmer with boneyard"
```

---

## Chunk 4: Validation and Cleanup

### Task 10: Run lint and typecheck

- [ ] **Step 1: Run typecheck**

```bash
bun typecheck
```

Expected: No errors.

- [ ] **Step 2: Run lint**

```bash
bun lint
```

Expected: No errors.

- [ ] **Step 3: Fix any issues found**

Address any type errors or lint violations. Common issues:

- Import ordering (eslint simple-import-sort)
- Unused imports from old `Skeleton`
- Type mismatches with boneyard's `Skeleton` props

- [ ] **Step 4: Run format**

```bash
bun format
```

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git commit -m "chore: fix lint and formatting after boneyard migration"
git push -u origin claude/replace-skeletons-boneyard-i5LLr
```
