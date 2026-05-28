# New User Demo Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-run, dismissible popup on the empty chat route that plays the existing Polymorph demo video and then gets users back to the composer.

**Architecture:** Add one focused client component that owns localStorage gating, dialog state, video markup, and dismissal behavior. Mount it from `components/chat.tsx`, where the chat route already knows whether the user is on a new empty conversation, while keeping app shell, canvas, and chat-panel behavior unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, local Radix dialog primitives from `components/ui/dialog.tsx`, lucide-react, Vitest, Testing Library, and browser QA against `bun dev` on port 43100.

---

## Current Evidence

- `app/(chat)/page.tsx:5-7` renders `Chat` for the root chat surface and passes `isGuest`.
- `components/chat.tsx:860-985` owns the chat shell render and is the correct mount point because it has `messages`, `providedId`, and `query`.
- `components/chat-panel.tsx:324-340` renders the composer textarea with `name="input"` and `aria-label="Message input"`, so the popup can close and focus the composer without widening `ChatPanelProps`.
- `components/ui/dialog.tsx:1-116` provides the existing Radix dialog primitive to reuse.
- `docs/assets/demos/polymorph-demo.mp4` exists, is H.264, 1280x720, 30 fps, and 47 seconds.
- `.gitignore:66-69` already makes `docs/assets/demos/polymorph-demo.mp4` the explicit checked-in demo MP4, but Next only serves static files from `public/`, so runtime playback needs a public copy or a route handler.

## Design Direction

Scene: a new explorer lands on the empty Polymorph chat in normal working light and needs one fast proof that the composer can become research, generated UI, and operational evaluation work.

Use a restrained product treatment, not a marketing hero. The dialog should feel like a quiet product premiere: a compact header, the real 16:9 video as the dominant element, one concise sentence, and two clear actions. Use the local neutral surface, hairline borders, `rounded-xl` video framing, and `accent-blue` only for the primary action or focus ring. Do not use gradient text, decorative blobs, glass panels, nested cards, or a broad purple/blue campaign palette.

Behavior rules:

- Show only on the empty root chat surface: `messages.length === 0`, no `providedId`, and no `query`.
- Show once per browser using localStorage key `polymorph:new-user-demo:v1`.
- Persist dismissal when the dialog closes, when the user skips, or when they choose the primary action.
- Keep the demo optional. Escape, close button, overlay click, and `Skip` all work.
- Autoplay muted with controls for standard users. If `prefers-reduced-motion: reduce` matches, do not auto-play; show the same controls and let the user press play.
- After the primary action, close the dialog and focus `textarea[name="input"]`.

## File Structure

- Create: `components/new-user-demo-popup.tsx`
  - Client component for localStorage gating, reduced-motion handling, dialog state, video playback, and composer focus.
- Create: `components/new-user-demo-popup.test.tsx`
  - Component-level behavior tests for eligibility, first-run display, dismissal persistence, video attributes, and primary action focus callback.
- Modify: `components/chat.tsx`
  - Import and mount `NewUserDemoPopup` near the existing overlay components, passing a single `enabled` prop.
- Modify: `components/chat.test.tsx`
  - Mock `NewUserDemoPopup` and add narrow integration tests for the `enabled` value from root-empty, query, and existing-chat states.
- Create: `public/demos/polymorph-demo.mp4`
  - Copy from `docs/assets/demos/polymorph-demo.mp4` so the browser can request `/demos/polymorph-demo.mp4` directly.

---

### Task 1: Add Failing Popup Component Tests

**Files:**

- Create: `components/new-user-demo-popup.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NewUserDemoPopup } from './new-user-demo-popup'

const storageKey = 'polymorph:new-user-demo:v1'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
})

describe('NewUserDemoPopup', () => {
  it('does not render when disabled', () => {
    render(<NewUserDemoPopup enabled={false} />)

    expect(
      screen.queryByRole('dialog', { name: /watch polymorph in motion/i })
    ).not.toBeInTheDocument()
  })

  it('opens for eligible first-run users and renders the demo video', async () => {
    render(<NewUserDemoPopup enabled />)

    expect(
      await screen.findByRole('dialog', { name: /watch polymorph in motion/i })
    ).toBeInTheDocument()

    const video = screen.getByTitle('Polymorph demo video')
    expect(video).toHaveAttribute('src', '/demos/polymorph-demo.mp4')
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('muted')
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveAttribute('autoplay')
  })

  it('does not autoplay when reduced motion is preferred', async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))

    render(<NewUserDemoPopup enabled />)

    const video = await screen.findByTitle('Polymorph demo video')
    expect(video).not.toHaveAttribute('autoplay')
  })

  it('persists dismissal when skipped', async () => {
    render(<NewUserDemoPopup enabled />)

    fireEvent.click(await screen.findByRole('button', { name: /skip/i }))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /watch polymorph in motion/i })
      ).not.toBeInTheDocument()
    })
    expect(localStorage.getItem(storageKey)).toContain('dismissedAt')
  })

  it('stays hidden when already dismissed', () => {
    localStorage.setItem(storageKey, JSON.stringify({ dismissedAt: 'now' }))

    render(<NewUserDemoPopup enabled />)

    expect(
      screen.queryByRole('dialog', { name: /watch polymorph in motion/i })
    ).not.toBeInTheDocument()
  })

  it('runs the primary action before closing', async () => {
    const onStart = vi.fn()
    render(<NewUserDemoPopup enabled onStart={onStart} />)

    fireEvent.click(
      await screen.findByRole('button', { name: /start exploring/i })
    )

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(storageKey)).toContain('dismissedAt')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails because the component does not exist**

Run:

```bash
bun run test -- components/new-user-demo-popup.test.tsx
```

Expected: FAIL with a module resolution error for `./new-user-demo-popup`.

- [ ] **Step 3: Commit the failing test**

```bash
git add components/new-user-demo-popup.test.tsx
git commit -m "test: cover new user demo popup"
```

---

### Task 2: Implement The Popup And Runtime Video Asset

**Files:**

- Create: `components/new-user-demo-popup.tsx`
- Create: `public/demos/polymorph-demo.mp4`

- [ ] **Step 1: Copy the existing demo asset into the public runtime path**

Run:

```bash
mkdir -p public/demos
cp docs/assets/demos/polymorph-demo.mp4 public/demos/polymorph-demo.mp4
```

Expected: `public/demos/polymorph-demo.mp4` exists and is playable from `/demos/polymorph-demo.mp4` in the Next dev server.

- [ ] **Step 2: Create the component**

```tsx
'use client'

import { useEffect, useState } from 'react'

import { Play } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

const STORAGE_KEY = 'polymorph:new-user-demo:v1'
const DEMO_VIDEO_SRC = '/demos/polymorph-demo.mp4'

interface NewUserDemoPopupProps {
  enabled: boolean
  onStart?: () => void
}

function markDismissed() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dismissedAt: new Date().toISOString() })
    )
  } catch {
    // localStorage can be unavailable in private or constrained browser modes.
  }
}

function hasDismissedDemo() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return true
  }
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function NewUserDemoPopup({ enabled, onStart }: NewUserDemoPopupProps) {
  const [open, setOpen] = useState(false)
  const [shouldAutoplay, setShouldAutoplay] = useState(false)

  useEffect(() => {
    if (!enabled || hasDismissedDemo()) return

    setShouldAutoplay(!prefersReducedMotion())
    setOpen(true)
  }, [enabled])

  const close = () => {
    markDismissed()
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          close()
          return
        }
        setOpen(true)
      }}
    >
      <DialogContent className="max-h-[min(760px,calc(100dvh-2rem))] overflow-auto p-0 sm:max-w-[760px]">
        <div className="p-4 sm:p-5">
          <DialogHeader className="gap-2 text-left">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full border bg-muted">
                <Play className="size-4 fill-current text-accent-blue" />
              </span>
              <DialogTitle className="text-base font-semibold">
                Watch Polymorph in motion
              </DialogTitle>
            </div>
            <DialogDescription>
              A 47 second look at research, canvas artifacts, generative UI, and
              evals in one workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 overflow-hidden rounded-xl border bg-muted">
            <video
              title="Polymorph demo video"
              src={DEMO_VIDEO_SRC}
              className="aspect-video w-full bg-background"
              controls
              muted
              playsInline
              autoPlay={shouldAutoplay}
              preload="metadata"
            />
          </div>

          <DialogFooter className="mt-4 gap-2 sm:justify-between sm:space-x-0">
            <Button type="button" variant="ghost" onClick={close}>
              Skip
            </Button>
            <Button
              type="button"
              className={cn('min-w-36')}
              onClick={() => {
                close()
                onStart?.()
              }}
            >
              Start exploring
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Run the popup tests**

Run:

```bash
bun run test -- components/new-user-demo-popup.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit the component and asset**

```bash
git add components/new-user-demo-popup.tsx public/demos/polymorph-demo.mp4
git commit -m "feat: add new user demo popup"
```

---

### Task 3: Wire The Popup Into The Chat Shell

**Files:**

- Modify: `components/chat.tsx`
- Modify: `components/chat.test.tsx`

- [ ] **Step 1: Add the chat integration tests first**

Add the mock near the existing child component mocks in `components/chat.test.tsx`:

```tsx
const mockNewUserDemoPopup = vi.fn((_props?: unknown) => null)

vi.mock('./new-user-demo-popup', () => ({
  NewUserDemoPopup: (props: unknown) => {
    mockNewUserDemoPopup(props)
    return null
  }
}))
```

Reset it in `beforeEach`:

```tsx
mockNewUserDemoPopup.mockClear()
```

Add these tests near the other `Chat` render tests:

```tsx
describe('new user demo popup eligibility', () => {
  it('enables the demo popup on an empty root chat', () => {
    mockUseChat.mockReturnValue(makeUseChatReturnValue([]))

    render(<Chat savedMessages={[]} />)

    expect(mockNewUserDemoPopup).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true })
    )
  })

  it('disables the demo popup when an existing chat id is loaded', () => {
    mockUseChat.mockReturnValue(makeUseChatReturnValue([]))

    render(<Chat id="chat-existing" savedMessages={[]} />)

    expect(mockNewUserDemoPopup).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    )
  })

  it('disables the demo popup when an initial query will auto-submit', () => {
    mockUseChat.mockReturnValue(makeUseChatReturnValue([]))

    render(<Chat savedMessages={[]} query="research local-first evals" />)

    expect(mockNewUserDemoPopup).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    )
  })
})
```

- [ ] **Step 2: Run the chat test and confirm it fails**

Run:

```bash
bun run test -- components/chat.test.tsx
```

Expected: FAIL because `NewUserDemoPopup` is not imported or mounted yet.

- [ ] **Step 3: Import and mount the popup in `components/chat.tsx`**

Add the import:

```tsx
import { NewUserDemoPopup } from './new-user-demo-popup'
```

Add the eligibility value near `initialPartIds`:

```tsx
const shouldShowNewUserDemo =
  messages.length === 0 && !providedId && !query?.trim()
```

Mount the component near the other overlay-level components, after `ChatPanel` and before `VoiceOrb`:

```tsx
<NewUserDemoPopup
  enabled={shouldShowNewUserDemo}
  onStart={() => {
    document
      .querySelector<HTMLTextAreaElement>('textarea[name="input"]')
      ?.focus()
  }}
/>
```

- [ ] **Step 4: Run the focused tests**

Run:

```bash
bun run test -- components/new-user-demo-popup.test.tsx components/chat.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the chat integration**

```bash
git add components/chat.tsx components/chat.test.tsx
git commit -m "feat: show demo popup for new chats"
```

---

### Task 4: Polish, Accessibility, And Browser QA

**Files:**

- Verify: `components/new-user-demo-popup.tsx`
- Verify: `public/demos/polymorph-demo.mp4`

- [ ] **Step 1: Run repository gates**

Run:

```bash
bun lint
bun typecheck
bun run test -- components/new-user-demo-popup.test.tsx components/chat.test.tsx
```

Expected: all commands PASS with no warnings.

- [ ] **Step 2: Start the dev server**

Run:

```bash
bun dev
```

Expected: Next.js starts on `http://localhost:43100`.

- [ ] **Step 3: Verify desktop behavior in the browser**

Use a fresh browser context or clear the key before loading:

```js
localStorage.removeItem('polymorph:new-user-demo:v1')
```

Check `http://localhost:43100/` at 1440x900:

- Dialog appears on the empty chat only.
- The MP4 loads from `/demos/polymorph-demo.mp4`.
- The video has visible controls and plays muted.
- Close, Escape, overlay click, `Skip`, and `Start exploring` all close the dialog.
- `Start exploring` focuses the composer.
- Reloading after dismissal does not show the dialog again.

- [ ] **Step 4: Verify mobile behavior in the browser**

Check `http://localhost:43100/` at 390x844:

- Dialog fits inside the viewport without text or controls clipping.
- Video remains 16:9 and does not overlap the header or composer.
- Footer actions remain reachable above safe-area padding.
- Reduced motion simulation disables autoplay while leaving controls available.

- [ ] **Step 5: Commit any QA polish**

If QA requires small class or copy adjustments:

```bash
git add components/new-user-demo-popup.tsx components/new-user-demo-popup.test.tsx components/chat.tsx components/chat.test.tsx
git commit -m "fix: polish demo popup interaction"
```

If QA passes with no changes, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan covers first-run gating, video playback, dismissal persistence, reduced-motion behavior, composer return path, tests, and browser QA.
- Placeholder scan: No placeholder markers or deferred implementation details remain.
- Type consistency: The planned component is `NewUserDemoPopup`, the storage key is `polymorph:new-user-demo:v1`, and the runtime video path is `/demos/polymorph-demo.mp4` in every task.
- Scope check: The plan intentionally does not add account-level onboarding state, analytics, a replay menu item, a route handler, or a full guided tour. Those can be follow-ups if product wants them after the first-run popup ships.
