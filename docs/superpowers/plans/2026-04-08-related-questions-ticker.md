# Related Questions Inline Ticker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the full vertical list of related questions with a single-line "Related" label that cycles through suggestions one at a time, then stops — leaving just the label.

**Architecture:** A new `useTickerRotation` hook manages the timer-based cycling (fade in → display → fade out → next). The `RelatedQuestions` component is rewritten to render a single-line layout with a fixed "Related" label and a slot that rotates through suggestions. The `isLatestMessage` prop (already available in the render tree) determines whether a ticker is active or static.

**Tech Stack:** React 19, Tailwind CSS v4, CSS keyframe animations, Vitest + React Testing Library

**Demo reference:** `demos/related-questions-concept.html` — open in a browser to see exact target behavior.

---

## File Structure

| Action | File                                      | Responsibility                                                                               |
| ------ | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Create | `hooks/use-ticker-rotation.ts`            | Timer logic: cycles through items with fade states, pauses on hover, stops after N rotations |
| Create | `hooks/use-ticker-rotation.test.ts`       | Tests for the hook: cycling, stopping, pause/resume                                          |
| Modify | `components/related-questions.tsx`        | Rewrite UI from vertical list → single-line ticker                                           |
| Modify | `app/globals.css`                         | Add `ticker-in` and `ticker-out` keyframe animations                                         |
| Modify | `components/data-section.tsx`             | Pass `isLatestMessage` through to `RelatedQuestions`                                         |
| Modify | `components/research-process-section.tsx` | Accept and forward `isLatestMessage` prop                                                    |
| Modify | `components/render-message.tsx`           | Pass `isLatestMessage` to `ResearchProcessSection`                                           |

---

### Task 1: Add CSS Keyframe Animations

**Files:**

- Modify: `app/globals.css:303` (after the `content-enter` keyframes block)

- [ ] **Step 1: Add ticker keyframes to globals.css**

Add these two keyframes and utility classes after the existing `@utility animate-content-enter` block (after line 381):

```css
@keyframes ticker-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ticker-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-6px);
  }
}

@utility animate-ticker-in {
  animation: ticker-in 0.5s ease both;
}

@utility animate-ticker-out {
  animation: ticker-out 0.4s ease both;
}
```

- [ ] **Step 2: Verify no build errors**

Run: `bun run build 2>&1 | tail -5`
Expected: Build succeeds with no CSS errors.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): add ticker-in and ticker-out CSS keyframe animations"
```

---

### Task 2: Create `useTickerRotation` Hook

**Files:**

- Create: `hooks/use-ticker-rotation.ts`

This hook manages cycling through a list of items with three states per item: `entering`, `visible`, `exiting`. After a configurable number of full rotations, it stops.

- [ ] **Step 1: Write the failing test**

Create `hooks/use-ticker-rotation.test.ts`:

```typescript
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTickerRotation } from './use-ticker-rotation'

describe('useTickerRotation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('returns idle state when items are empty', () => {
    const { result } = renderHook(() =>
      useTickerRotation({ items: [], displayMs: 3000, rotations: 2 })
    )
    expect(result.current.activeIndex).toBe(-1)
    expect(result.current.phase).toBe('idle')
    expect(result.current.isComplete).toBe(true)
  })

  it('starts with the first item entering', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 3000, rotations: 2 })
    )
    expect(result.current.activeIndex).toBe(0)
    expect(result.current.phase).toBe('entering')
    expect(result.current.isComplete).toBe(false)
  })

  it('transitions to visible after enter animation', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 3000, rotations: 2 })
    )
    // Enter animation takes 500ms
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.phase).toBe('visible')
  })

  it('transitions to exiting after display time', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 3000, rotations: 2 })
    )
    // 500ms enter + 3000ms display
    act(() => {
      vi.advanceTimersByTime(3500)
    })
    expect(result.current.phase).toBe('exiting')
  })

  it('advances to next item after exit animation', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 3000, rotations: 2 })
    )
    // 500ms enter + 3000ms display + 400ms exit
    act(() => {
      vi.advanceTimersByTime(3900)
    })
    expect(result.current.activeIndex).toBe(1)
    expect(result.current.phase).toBe('entering')
  })

  it('stops after the configured number of rotations', () => {
    const items = ['a', 'b']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 1000, rotations: 2 })
    )
    // Each item cycle: 500 enter + 1000 display + 400 exit = 1900ms
    // 2 items × 2 rotations = 4 cycles
    // Last cycle doesn't have exit (it fades out and stops)
    // Cycles 1-3: 1900ms each = 5700ms
    // Cycle 4: 500 enter + 1000 display + 400 exit = 1900ms, then stops
    const totalTime = 1900 * 4
    act(() => {
      vi.advanceTimersByTime(totalTime)
    })
    expect(result.current.isComplete).toBe(true)
    expect(result.current.phase).toBe('idle')
  })

  it('pauses and resumes cycling', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 3000, rotations: 2 })
    )
    // Enter phase completes
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.phase).toBe('visible')

    // Pause during visible phase
    act(() => {
      result.current.pause()
    })

    // Time passes but state shouldn't change
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(result.current.phase).toBe('visible')
    expect(result.current.activeIndex).toBe(0)

    // Resume
    act(() => {
      result.current.resume()
    })
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.phase).toBe('exiting')
  })

  it('does not rotate when isActive is false', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({
        items,
        displayMs: 3000,
        rotations: 2,
        isActive: false
      })
    )
    expect(result.current.activeIndex).toBe(-1)
    expect(result.current.phase).toBe('idle')
    expect(result.current.isComplete).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `bun run test -- hooks/use-ticker-rotation.test.ts`
Expected: FAIL — module `./use-ticker-rotation` not found.

- [ ] **Step 3: Implement the hook**

Create `hooks/use-ticker-rotation.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react'

type Phase = 'entering' | 'visible' | 'exiting' | 'idle'

const ENTER_MS = 500
const EXIT_MS = 400

interface UseTickerRotationOptions<T> {
  items: T[]
  displayMs: number
  rotations: number
  isActive?: boolean
}

interface UseTickerRotationReturn {
  activeIndex: number
  phase: Phase
  isComplete: boolean
  pause: () => void
  resume: () => void
}

export function useTickerRotation<T>({
  items,
  displayMs,
  rotations,
  isActive = true
}: UseTickerRotationOptions<T>): UseTickerRotationReturn {
  const [activeIndex, setActiveIndex] = useState(-1)
  const [phase, setPhase] = useState<Phase>('idle')
  const [isComplete, setIsComplete] = useState(false)
  const isPausedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showCountRef = useRef(0)
  const totalShows = items.length * rotations

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleNext = useCallback(
    (delay: number, callback: () => void) => {
      clearTimer()
      timerRef.current = setTimeout(() => {
        if (!isPausedRef.current) {
          callback()
        } else {
          // Store the callback to resume later
          timerRef.current = null
          const checkResume = () => {
            if (!isPausedRef.current) {
              callback()
            } else {
              timerRef.current = setTimeout(checkResume, 100)
            }
          }
          timerRef.current = setTimeout(checkResume, 100)
        }
      }, delay)
    },
    [clearTimer]
  )

  // Start cycling
  useEffect(() => {
    if (!isActive || items.length === 0) {
      setActiveIndex(-1)
      setPhase('idle')
      setIsComplete(true)
      return
    }

    showCountRef.current = 0
    setIsComplete(false)
    setActiveIndex(0)
    setPhase('entering')

    return () => {
      clearTimer()
    }
  }, [isActive, items.length, clearTimer])

  // Phase state machine
  useEffect(() => {
    if (!isActive || items.length === 0 || isComplete) return

    if (phase === 'entering') {
      scheduleNext(ENTER_MS, () => setPhase('visible'))
    } else if (phase === 'visible') {
      scheduleNext(displayMs, () => {
        showCountRef.current++
        if (showCountRef.current >= totalShows) {
          setPhase('exiting')
        } else {
          setPhase('exiting')
        }
      })
    } else if (phase === 'exiting') {
      scheduleNext(EXIT_MS, () => {
        if (showCountRef.current >= totalShows) {
          setPhase('idle')
          setActiveIndex(-1)
          setIsComplete(true)
        } else {
          setActiveIndex(prev => (prev + 1) % items.length)
          setPhase('entering')
        }
      })
    }

    return () => {
      clearTimer()
    }
  }, [
    phase,
    isActive,
    items.length,
    isComplete,
    displayMs,
    totalShows,
    scheduleNext,
    clearTimer
  ])

  const pause = useCallback(() => {
    isPausedRef.current = true
  }, [])

  const resume = useCallback(() => {
    isPausedRef.current = false
  }, [])

  return { activeIndex, phase, isComplete, pause, resume }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- hooks/use-ticker-rotation.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-ticker-rotation.ts hooks/use-ticker-rotation.test.ts
git commit -m "feat: add useTickerRotation hook for cycling through items with fade transitions"
```

---

### Task 3: Thread `isLatestMessage` to `RelatedQuestions`

**Files:**

- Modify: `components/render-message.tsx` (~line 349-359)
- Modify: `components/research-process-section.tsx` (~line 62-71, 190, 250)
- Modify: `components/data-section.tsx`

Currently `isLatestMessage` is available in `RenderMessage` but not passed down to `ResearchProcessSection` → `DataSection` → `RelatedQuestions`. We need to thread it through.

- [ ] **Step 1: Add `isLatestMessage` prop to `ResearchProcessSection`**

In `components/research-process-section.tsx`, add `isLatestMessage` to the `Props` type (around line 62):

```typescript
type Props = {
  message: UIMessage
  messageId: string
  getIsOpen: (id: string, partType?: string, hasNextPart?: boolean) => boolean
  onOpenChange: (id: string, open: boolean) => void
  onQuerySelect: (query: string) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  parts?: MessagePart[]
  isLatestMessage?: boolean
}
```

Destructure it in the component function (around line 190 where other props are destructured) and pass it to `DataSection` at the call site (around line 250):

```tsx
return (
  <DataSection
    part={part}
    onQuerySelect={onQuerySelect}
    isLatestMessage={isLatestMessage}
  />
)
```

- [ ] **Step 2: Pass `isLatestMessage` from `RenderMessage` to `ResearchProcessSection`**

In `components/render-message.tsx`, find the `ResearchProcessSection` JSX (around line 349) and add the prop:

```tsx
<ResearchProcessSection
  key={`${messageId}-proc-${keySuffix}`}
  message={message}
  messageId={messageId}
  parts={buffer as Parameters<typeof ResearchProcessSection>[0]['parts']}
  getIsOpen={getIsOpen}
  onOpenChange={onOpenChange}
  onQuerySelect={onQuerySelect}
  status={status}
  addToolResult={addToolResult}
  isLatestMessage={isLatestMessage}
/>
```

- [ ] **Step 3: Update `DataSection` to accept and pass `isLatestMessage`**

In `components/data-section.tsx`:

```tsx
'use client'

import React from 'react'

import type { DataPart } from '@/lib/types/ai'

import { RelatedQuestions } from './related-questions'

interface DataSectionProps {
  part: DataPart
  onQuerySelect?: (query: string) => void
  isLatestMessage?: boolean
}

export function DataSection({
  part,
  onQuerySelect,
  isLatestMessage
}: DataSectionProps) {
  switch (part.type) {
    case 'data-relatedQuestions':
      if (onQuerySelect) {
        return (
          <RelatedQuestions
            data={part.data}
            onQuerySelect={onQuerySelect}
            isLatestMessage={isLatestMessage}
          />
        )
      }
      return null

    default:
      return null
  }
}
```

- [ ] **Step 4: Run typecheck to verify prop threading**

Run: `bun typecheck 2>&1 | tail -10`
Expected: Type errors about `RelatedQuestions` not accepting `isLatestMessage` yet — that's expected, we'll fix it in Task 4. If there are other errors, fix them first.

- [ ] **Step 5: Commit**

```bash
git add components/render-message.tsx components/research-process-section.tsx components/data-section.tsx
git commit -m "refactor: thread isLatestMessage prop to DataSection for related questions"
```

---

### Task 4: Rewrite `RelatedQuestions` Component

**Files:**

- Modify: `components/related-questions.tsx`

Replace the vertical list with a single-line ticker. When `isLatestMessage` is true, the ticker actively rotates. When false (or after rotation completes), it shows just the static "Related" label.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `components/related-questions.tsx`:

```tsx
'use client'

import React from 'react'

import { ArrowRight, Repeat2 } from 'lucide-react'

import type { RelatedQuestionsData } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import { useTickerRotation } from '@/hooks/use-ticker-rotation'

import { Button } from './ui/button'

interface RelatedQuestionsProps {
  data: RelatedQuestionsData
  onQuerySelect: (query: string) => void
  isLatestMessage?: boolean
}

export const RelatedQuestions: React.FC<RelatedQuestionsProps> = ({
  data,
  onQuerySelect,
  isLatestMessage = false
}) => {
  const questions = data.questions ?? []
  const isReady = data.status === 'success' && questions.length > 0

  const { activeIndex, phase, pause, resume } = useTickerRotation({
    items: questions,
    displayMs: 3000,
    rotations: 2,
    isActive: isReady && isLatestMessage
  })

  // Don't render anything until we have questions
  if (!isReady) return null

  return (
    <div
      className="flex items-center gap-2 h-7 mt-4 overflow-hidden"
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {/* Static label — always visible */}
      <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground shrink-0">
        <Repeat2 size={16} className="text-muted-foreground" />
        Related
      </span>

      {/* Ticker slot — only shows when actively rotating */}
      {activeIndex >= 0 && (
        <>
          <span className="w-px h-3.5 bg-border shrink-0" />
          <div className="relative flex-1 min-w-0 h-7">
            {questions.map((item, index) => (
              <Button
                key={index}
                variant="link"
                className={cn(
                  'absolute inset-0 flex items-center gap-1.5 px-0 py-0 h-7',
                  'text-sm text-muted-foreground hover:text-foreground',
                  'justify-start whitespace-nowrap overflow-hidden text-ellipsis',
                  'opacity-0 no-underline',
                  index === activeIndex &&
                    phase === 'entering' &&
                    'animate-ticker-in',
                  index === activeIndex && phase === 'visible' && 'opacity-100',
                  index === activeIndex &&
                    phase === 'exiting' &&
                    'animate-ticker-out'
                )}
                onClick={() => onQuerySelect(item.question)}
              >
                <ArrowRight size={12} className="shrink-0 opacity-40" />
                <span className="truncate">{item.question}</span>
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default RelatedQuestions
```

- [ ] **Step 2: Run typecheck**

Run: `bun typecheck 2>&1 | tail -10`
Expected: PASS — no type errors.

- [ ] **Step 3: Run lint**

Run: `bun lint 2>&1 | tail -10`
Expected: PASS — no lint errors.

- [ ] **Step 4: Verify in browser**

Run: `bun dev`
Open the app and perform a search. Observe:

- The latest response shows "Related" with suggestions cycling in/out one at a time
- After 2 full rotations (6 total for 3 questions), only "Related" remains
- Hover pauses the rotation
- Clicking a suggestion fills the input and triggers a search
- Older responses show only the static "Related" label

- [ ] **Step 5: Commit**

```bash
git add components/related-questions.tsx
git commit -m "feat: rewrite RelatedQuestions as inline ticker with auto-cycling suggestions"
```

---

### Task 5: Remove Unused Dependencies

**Files:**

- Modify: `components/related-questions.tsx` (verify)
- Modify: `components/section.tsx` (verify the "Related" case is still needed elsewhere — if not, clean up)

- [ ] **Step 1: Check if the `Section` component's "Related" case is used elsewhere**

Run: `grep -rn "title=\"Related\"" components/` to see if any other component uses `<Section title="Related">`.

If the only usage was in the old `RelatedQuestions`, the case in `section.tsx` is now dead code. Leave it for now — it's part of a shared switch and removing it is a separate cleanup.

- [ ] **Step 2: Verify the old imports are removed**

Confirm `related-questions.tsx` no longer imports `CollapsibleMessage`, `Section`, or `Skeleton` (these were used by the old vertical list layout).

- [ ] **Step 3: Run full checks**

Run: `bun lint && bun typecheck`
Expected: Both PASS with zero warnings or errors.

- [ ] **Step 4: Commit (if any cleanup was needed)**

```bash
git add -A
git commit -m "chore: remove unused imports from related questions rewrite"
```

---

### Task 6: Clean Up Demo File

**Files:**

- Delete or move: `demos/related-questions-concept.html`

- [ ] **Step 1: Remove the demo file**

The demo served its purpose during design exploration. Remove it so it doesn't ship:

```bash
rm demos/related-questions-concept.html
rmdir demos 2>/dev/null || true
```

- [ ] **Step 2: Verify the `pb-14` fix from earlier is still in place**

Check `components/chat-messages.tsx` around line 174. It should conditionally apply `pb-14` only to non-last sections:

```tsx
className={cn(
  'chat-section',
  sectionIndex < sections.length - 1 && 'pb-14'
)}
```

If this change is missing, re-apply it per the earlier conversation.

- [ ] **Step 3: Final full check**

Run: `bun lint && bun typecheck && bun run test`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove related questions design demo"
```
