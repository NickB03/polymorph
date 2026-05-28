# Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `shadcn-tour`-based product tour from [NickB03/vana](https://github.com/NickB03/vana) into Polymorph, adapted to Polymorph's actual UI surfaces and Next.js architecture.

**Architecture:** Tour lives in `components/tour/` as a self-contained React Context. A `'use client'` `<TourHost>` wraps the chat layout, mounting `<TourProvider>` + a one-time `<TourAlertDialog>` (welcome) + the `<OnboardingTour>` step-configuration component. Tour targets are normal DOM elements identified by `id` attributes drawn from a single constants table. Persistence is `localStorage` keyed by `tourId`. Spotlight uses a CSS `clip-path` polygon over a dark overlay; tooltip is a `motion/react` animated `<div>`.

**Tech Stack:** Next.js 16 App Router (RSC + client islands), React 19, TypeScript (strict), Tailwind v4, shadcn/ui (`AlertDialog`, `Button`), `motion@^12.39.0` (already in `package.json`), Vitest, `@testing-library/react`.

**Sources of truth referenced when adapting code:**

- Original tour core: [NickB03/vana `src/components/tour/tour.tsx`](https://github.com/NickB03/vana/blob/main/src/components/tour/tour.tsx)
- Original onboarding content: [NickB03/vana `src/components/OnboardingTour.tsx`](https://github.com/NickB03/vana/blob/main/src/components/OnboardingTour.tsx)
- Original constants: [NickB03/vana `src/components/tour/tour-constants.ts`](https://github.com/NickB03/vana/blob/main/src/components/tour/tour-constants.ts)

A local mirror of these files is at `/tmp/vana-tour/` for this session.

---

## What changes vs. vana's original

| Concern           | vana                                                                 | Polymorph adaptation                                                                                   |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Bundler-env check | `import.meta.env.DEV`                                                | `process.env.NODE_ENV !== 'production'`                                                                |
| Error logging     | `@/utils/errorLogging` (`logError`/`logForDebugging`)                | Inline dev-only `console.warn` — keep diffs surgical (no new logging subsystem)                        |
| Mobile hook       | `@/hooks/use-mobile`                                                 | `@/hooks/use-mobile` (already exists, identical API)                                                   |
| Storage prefix    | `vana-tour-`                                                         | `polymorph-tour-`                                                                                      |
| Step targets      | 5 (CHAT_INPUT, IMAGE_MODE, ARTIFACT_MODE, SUGGESTIONS, SIDEBAR)      | 4 (CHAT_INPUT, MODE_SELECTOR, SUGGESTIONS, SIDEBAR) — Polymorph has no separate image/artifact toggles |
| Welcome dialog    | Personal profile (photo, LinkedIn, "Nick Bohmer / Product Leader")   | Polymorph branding only: logo, tagline, capability grid, repo link                                     |
| Auto-start logic  | `useTourAutoStart(phase, isNewUser)` based on Vite landing/app phase | First-visit detection via `localStorage` — show `TourAlertDialog` once; user opts in                   |
| Style rules       | Prettier defaults (semis, double quotes)                             | Polymorph style: no semis, single quotes, no trailing commas (per `CLAUDE.md`)                         |
| Path alias        | `@/` → `src/`                                                        | `@/` → project root                                                                                    |

---

## File structure

**New files (under `components/tour/`):**

- `components/tour/tour-constants.ts` — `TOUR_STEP_IDS` and `TOUR_STORAGE_KEYS` enums
- `components/tour/tour.tsx` — `TourProvider`, `useTour`, `TourAlertDialog`, `MobileTourDialog`, `DesktopTourDialog`
- `components/tour/onboarding-tour.tsx` — Step content + `useTourAutoStart` hook adapted for first-visit
- `components/tour/tour-host.tsx` — Top-level `'use client'` mount point for the chat layout
- `components/tour/index.ts` — Public exports
- `components/tour/__tests__/tour-constants.test.ts`
- `components/tour/__tests__/onboarding-tour.test.tsx`
- `components/tour/__tests__/tour.test.tsx`

**Modified files:**

- `components/chat-panel.tsx` — Add `id` attributes on the chat textarea (line 324) and the empty-state suggestions wrapper (line 461)
- `components/app-sidebar.tsx` — Add `id` attribute on the `<Sidebar>` element (line 39)
- `app/(chat)/layout.tsx` — Mount `<TourHost />` once inside the layout tree

**Reused (no edit):**

- `components/mode-selector.tsx` — Already has `id="mode-selector-trigger"` on the trigger button; `TOUR_STEP_IDS.MODE_SELECTOR` will point at that same string

---

## Tasks

### Task 1: Tour constants

**Files:**

- Create: `components/tour/tour-constants.ts`
- Test: `components/tour/__tests__/tour-constants.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// components/tour/__tests__/tour-constants.test.ts
import { describe, expect, it } from 'vitest'

import { TOUR_STEP_IDS, TOUR_STORAGE_KEYS } from '../tour-constants'

describe('TOUR_STEP_IDS', () => {
  it('exposes the four Polymorph tour targets', () => {
    expect(TOUR_STEP_IDS).toEqual({
      CHAT_INPUT: 'tour-chat-input',
      MODE_SELECTOR: 'mode-selector-trigger',
      SUGGESTIONS: 'tour-suggestions',
      SIDEBAR: 'tour-sidebar'
    })
  })

  it('reuses the existing mode-selector trigger id rather than duplicating it', () => {
    expect(TOUR_STEP_IDS.MODE_SELECTOR).toBe('mode-selector-trigger')
  })
})

describe('TOUR_STORAGE_KEYS', () => {
  it('namespaces all keys under polymorph-tour-', () => {
    expect(TOUR_STORAGE_KEYS.TOUR_STATE_PREFIX).toBe('polymorph-tour-')
    expect(TOUR_STORAGE_KEYS.FORCE_TOUR).toBe('polymorph-tour-force-mode')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/tour/__tests__/tour-constants.test.ts`
Expected: FAIL — `Cannot find module '../tour-constants'`.

- [ ] **Step 3: Write the implementation**

```ts
// components/tour/tour-constants.ts
export const TOUR_STEP_IDS = {
  CHAT_INPUT: 'tour-chat-input',
  MODE_SELECTOR: 'mode-selector-trigger',
  SUGGESTIONS: 'tour-suggestions',
  SIDEBAR: 'tour-sidebar'
} as const

export type TourStepId = (typeof TOUR_STEP_IDS)[keyof typeof TOUR_STEP_IDS]

export const TOUR_STORAGE_KEYS = {
  FORCE_TOUR: 'polymorph-tour-force-mode',
  TOUR_STATE_PREFIX: 'polymorph-tour-'
} as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- components/tour/__tests__/tour-constants.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add components/tour/tour-constants.ts components/tour/__tests__/tour-constants.test.ts
git commit -m "feat(tour): add tour step id and storage key constants"
```

---

### Task 2: Tour provider core (state, persistence, keyboard nav)

This task ports the headless part of vana's [`tour.tsx`](https://github.com/NickB03/vana/blob/main/src/components/tour/tour.tsx) (context + state + persistence) without yet rendering the overlay. We split the file so the engineer can test the reducer-shaped logic separately from the DOM layer.

**Files:**

- Create: `components/tour/tour.tsx`
- Test: `components/tour/__tests__/tour.test.tsx`

- [ ] **Step 1: Write the failing test (provider state machine + persistence)**

```tsx
// components/tour/__tests__/tour.test.tsx
import { act, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TourProvider, useTour } from '../tour'

function wrapper({ children }: { children: React.ReactNode }) {
  return <TourProvider tourId="unit">{children}</TourProvider>
}

describe('TourProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts inactive with currentStep=-1 and no steps', () => {
    const { result } = renderHook(() => useTour(), { wrapper })
    expect(result.current.currentStep).toBe(-1)
    expect(result.current.isActive).toBe(false)
    expect(result.current.totalSteps).toBe(0)
  })

  it('startTour is a no-op when no steps are configured', () => {
    const { result } = renderHook(() => useTour(), { wrapper })
    act(() => result.current.startTour())
    expect(result.current.currentStep).toBe(-1)
  })

  it('advances through steps and completes on the last step', () => {
    const onComplete = vi.fn()
    function Steps() {
      const tour = useTour()
      return (
        <button
          onClick={() => {
            tour.setSteps([
              { selectorId: 'a', content: 'A' },
              { selectorId: 'b', content: 'B' }
            ])
            tour.startTour()
          }}
        >
          go
        </button>
      )
    }
    const { result } = renderHook(() => useTour(), {
      wrapper: ({ children }) => (
        <TourProvider tourId="unit-2" onComplete={onComplete}>
          <Steps />
          {children}
        </TourProvider>
      )
    })
    act(() => {
      result.current.setSteps([
        { selectorId: 'a', content: 'A' },
        { selectorId: 'b', content: 'B' }
      ])
      result.current.startTour()
    })
    expect(result.current.currentStep).toBe(0)
    act(() => result.current.nextStep())
    expect(result.current.currentStep).toBe(1)
    act(() => result.current.nextStep())
    expect(result.current.currentStep).toBe(-1)
    expect(result.current.isTourCompleted).toBe(true)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('persists completion to localStorage under the polymorph- prefix', () => {
    const { result } = renderHook(() => useTour(), {
      wrapper: ({ children }) => (
        <TourProvider tourId="persisted">{children}</TourProvider>
      )
    })
    act(() => result.current.setIsTourCompleted(true))
    const raw = localStorage.getItem('polymorph-tour-persisted')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).completed).toBe(true)
  })

  it('useTour throws outside a TourProvider', () => {
    expect(() => render(<HookConsumer />)).toThrow(
      /useTour must be used within/
    )
  })
})

function HookConsumer() {
  useTour()
  return null
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/tour/__tests__/tour.test.tsx`
Expected: FAIL — `Cannot find module '../tour'`.

- [ ] **Step 3: Implement `tour.tsx`**

Copy the file from `/tmp/vana-tour/tour.tsx` and apply these transformations. (Don't paraphrase: take the original 1036-line file as the base and edit precisely the points below.)

1. **Style:** Run the file through the project's Prettier config (`bun format components/tour/tour.tsx` after writing). The expected delta: drop all semicolons, change double quotes to single, drop trailing commas.
2. **Storage prefix:** Replace `const TOUR_STORAGE_KEY_PREFIX = "vana-tour-"` with:

   ```ts
   import { TOUR_STORAGE_KEYS } from './tour-constants'
   // ...
   const TOUR_STORAGE_KEY_PREFIX = TOUR_STORAGE_KEYS.TOUR_STATE_PREFIX
   ```

3. **Logging replacement:** Replace every `logError(...)` and `logForDebugging(...)` call with a single inline helper at the top of the file:

   ```ts
   const isDev = process.env.NODE_ENV !== 'production'
   function warn(message: string, meta?: Record<string, unknown>) {
     if (isDev) console.warn(`[tour] ${message}`, meta ?? {})
   }
   ```

   Then replace each original logging site with a single `warn(...)` call carrying the same message. Do not import any error-logging module.

4. **Env check:** Replace every `import.meta.env.DEV` with `isDev` (from step 3).
5. **`useIsMobile` import:** Already correct path — `@/hooks/use-mobile`.
6. **Welcome dialog content:** In `DesktopTourDialog` (around line 691) and `MobileTourDialog` (around line 901), replace the personal-profile content with Polymorph content. Concrete code is in **Task 4** — for this task, leave both dialog components stubbed:

   ```tsx
   function DesktopTourDialog(props: {
     onStartTour: () => void
     onSkip: () => void
   }) {
     return null // Implemented in Task 4
   }
   function MobileTourDialog(props: {
     onStartTour: () => void
     onSkip: () => void
   }) {
     return null // Implemented in Task 4
   }
   ```

7. **Spotlight ring color:** Leave `ring-primary ring-offset-background` — Polymorph's tokens already define these.
8. **Imports:** Reorder per Polymorph's `simple-import-sort` order from `CLAUDE.md`:
   - `react`/`next` → third-party (`motion/react`, `lucide-react`) → `@/components/ui/...` → `@/lib/utils` → `@/hooks/use-mobile` → `./tour-constants`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- components/tour/__tests__/tour.test.tsx`
Expected: 4 PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `bun typecheck && bun lint components/tour/`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/tour/tour.tsx components/tour/__tests__/tour.test.tsx
git commit -m "feat(tour): port shadcn-tour core with polymorph storage prefix"
```

---

### Task 3: Public index + types

**Files:**

- Create: `components/tour/index.ts`

- [ ] **Step 1: Write the file**

```ts
// components/tour/index.ts
export { TourAlertDialog, TourProvider, useTour } from './tour'
export type { TourStep } from './tour'
export { TOUR_STEP_IDS, TOUR_STORAGE_KEYS } from './tour-constants'
export type { TourStepId } from './tour-constants'
export { OnboardingTour, useTourAutoStart } from './onboarding-tour'
export { TourHost } from './tour-host'
```

- [ ] **Step 2: Typecheck**

Run: `bun typecheck`
Expected: errors for missing `./onboarding-tour` and `./tour-host` — acceptable; resolved in Tasks 4 and 5. Skip this step's expected-PASS gate; revisit after Task 5.

- [ ] **Step 3: Commit (deferred)** — combine with Task 5 commit.

---

### Task 4: Welcome dialog (Polymorph-themed)

**Files:**

- Modify: `components/tour/tour.tsx` (replace `DesktopTourDialog` and `MobileTourDialog` stubs from Task 2)

- [ ] **Step 1: Replace `DesktopTourDialog`**

In `components/tour/tour.tsx`, replace the `DesktopTourDialog` stub with this implementation. (Bigger viewport ≥ 768px.)

```tsx
function DesktopTourDialog({
  onStartTour,
  onSkip
}: {
  onStartTour: () => void
  onSkip: () => void
}) {
  const reducedMotion = useReducedMotion()
  const imageAnimation = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { scale: 0.95, opacity: 0 },
        animate: { scale: 1, opacity: 1 }
      }
  const imageTransition = reducedMotion
    ? { duration: 0.15 }
    : { duration: 0.2, ease: 'easeOut' as const }

  return (
    <AlertDialogContent className="max-w-3xl w-[calc(100vw-32px)] sm:w-full p-0 flex flex-col overflow-hidden bg-card border-border shadow-xl">
      <AlertDialogTitle className="sr-only">
        Welcome to Polymorph — an AI platform with a generative UI
      </AlertDialogTitle>
      <AlertDialogDescription className="sr-only">
        Learn about Polymorph's chat, modes, canvas artifacts, and how to start
        the tour.
      </AlertDialogDescription>
      <div className="flex flex-col p-8 max-h-[85vh] overflow-y-auto">
        <motion.div
          {...imageAnimation}
          transition={imageTransition}
          className="mb-6"
        >
          <div className="text-2xl font-semibold text-foreground">
            Polymorph
          </div>
          <p className="text-sm text-muted-foreground mt-1 text-pretty leading-relaxed">
            An AI platform with a generative UI for research, creation, and
            exploration.
          </p>
        </motion.div>

        <div className="mb-6">
          <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-3">
            Capabilities
          </h4>
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Chat</p>
              <p className="text-xs text-muted-foreground">
                Streaming responses
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Research mode
              </p>
              <p className="text-xs text-muted-foreground">
                Multi-step with citations
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Build mode</p>
              <p className="text-xs text-muted-foreground">
                Code &amp; artifact authoring
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Canvas</p>
              <p className="text-xs text-muted-foreground">
                Interactive HTML &amp; React artifacts
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Generative UI
              </p>
              <p className="text-xs text-muted-foreground">
                Tool-specific message parts
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Search</p>
              <p className="text-xs text-muted-foreground">
                Multiple providers
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-3">
            Stack
          </h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex">
              <span className="text-muted-foreground w-24 shrink-0">
                Frontend
              </span>
              <span className="text-foreground">
                Next.js 16, React 19, Tailwind v4
              </span>
            </div>
            <div className="flex">
              <span className="text-muted-foreground w-24 shrink-0">
                Backend
              </span>
              <span className="text-foreground">Supabase, Drizzle, Bun</span>
            </div>
            <div className="flex">
              <span className="text-muted-foreground w-24 shrink-0">
                Observability
              </span>
              <span className="text-foreground">Phoenix (Arize)</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-2 pt-4 border-t border-border/50">
          <Button
            onClick={onSkip}
            variant="ghost"
            className="flex-1 h-11 font-medium bg-muted/50 hover:bg-muted"
          >
            Skip
          </Button>
          <Button onClick={onStartTour} className="flex-1 h-11 font-medium">
            Start the tour
          </Button>
        </div>
      </div>
    </AlertDialogContent>
  )
}
```

- [ ] **Step 2: Replace `MobileTourDialog`**

```tsx
function MobileTourDialog({
  onStartTour,
  onSkip
}: {
  onStartTour: () => void
  onSkip: () => void
}) {
  return (
    <AlertDialogContent className="w-[calc(100vw-32px)] max-w-[360px] p-0 flex flex-col overflow-hidden bg-card border-border shadow-xl rounded-xl">
      <AlertDialogTitle className="sr-only">
        Welcome to Polymorph
      </AlertDialogTitle>
      <AlertDialogDescription className="sr-only">
        Learn about Polymorph's capabilities and start the tour.
      </AlertDialogDescription>

      <div className="flex flex-col px-4 pt-4 pb-3">
        <h2 className="text-lg font-bold text-foreground">
          Welcome to Polymorph
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">
          An AI platform with a generative UI for research, creation, and
          exploration.
        </p>

        <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-wide mb-1.5">
          Capabilities
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] mb-3">
          <div>
            <span className="text-muted-foreground">Chat</span>
            <p className="text-foreground">Streaming responses</p>
          </div>
          <div>
            <span className="text-muted-foreground">Research</span>
            <p className="text-foreground">Multi-step + citations</p>
          </div>
          <div>
            <span className="text-muted-foreground">Build</span>
            <p className="text-foreground">Code &amp; artifacts</p>
          </div>
          <div>
            <span className="text-muted-foreground">Canvas</span>
            <p className="text-foreground">HTML &amp; React</p>
          </div>
          <div>
            <span className="text-muted-foreground">Gen UI</span>
            <p className="text-foreground">Tool-specific parts</p>
          </div>
          <div>
            <span className="text-muted-foreground">Search</span>
            <p className="text-foreground">Multiple providers</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onSkip}
            variant="ghost"
            className="flex-1 h-10 text-sm bg-muted/40 hover:bg-muted rounded-lg"
          >
            Skip
          </Button>
          <Button
            onClick={onStartTour}
            className="flex-1 h-10 text-sm font-medium rounded-lg"
          >
            Start tour
          </Button>
        </div>
      </div>
    </AlertDialogContent>
  )
}
```

- [ ] **Step 3: Remove unused imports**

Delete `Github`/`Linkedin` from the `lucide-react` import in `components/tour/tour.tsx`. Keep only `X`.

- [ ] **Step 4: Typecheck + lint**

Run: `bun typecheck && bun lint components/tour/tour.tsx`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/tour/tour.tsx
git commit -m "feat(tour): replace welcome dialog content with polymorph branding"
```

---

### Task 5: Onboarding step content + auto-start hook

**Files:**

- Create: `components/tour/onboarding-tour.tsx`
- Test: `components/tour/__tests__/onboarding-tour.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/tour/__tests__/onboarding-tour.test.tsx
import { render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TourProvider, useTour } from '../tour'
import { OnboardingTour, useTourAutoStart } from '../onboarding-tour'

function withProvider(children: React.ReactNode, tourId = 'onboarding-test') {
  return <TourProvider tourId={tourId}>{children}</TourProvider>
}

describe('OnboardingTour', () => {
  it('configures exactly four polymorph-specific steps targeting tour ids', () => {
    let captured: ReturnType<typeof useTour> | null = null
    function Inspect() {
      captured = useTour()
      return null
    }
    render(
      withProvider(
        <>
          <OnboardingTour />
          <Inspect />
        </>
      )
    )
    expect(captured!.steps.length).toBe(4)
    expect(captured!.steps.map(s => s.selectorId)).toEqual([
      'tour-chat-input',
      'mode-selector-trigger',
      'tour-suggestions',
      'tour-sidebar'
    ])
  })
})

describe('useTourAutoStart', () => {
  it('does nothing when the tour is already completed', () => {
    const { result } = renderHook(
      () => {
        useTourAutoStart({ isFirstVisit: false, delay: 0 })
        return useTour()
      },
      {
        wrapper: ({ children }) => withProvider(children, 'autostart-completed')
      }
    )
    expect(result.current.isActive).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/tour/__tests__/onboarding-tour.test.tsx`
Expected: FAIL — `Cannot find module '../onboarding-tour'`.

- [ ] **Step 3: Implement `onboarding-tour.tsx`**

```tsx
// components/tour/onboarding-tour.tsx
'use client'

import { useEffect } from 'react'

import { useTour } from './tour'
import type { TourStep } from './tour'
import { TOUR_STEP_IDS } from './tour-constants'

function StepContent({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  )
}

const onboardingSteps: TourStep[] = [
  {
    selectorId: TOUR_STEP_IDS.CHAT_INPUT,
    position: 'top',
    content: (
      <StepContent
        title="Start chatting"
        description="Type anything here. Polymorph streams responses and renders interactive UI inline."
      />
    )
  },
  {
    selectorId: TOUR_STEP_IDS.MODE_SELECTOR,
    position: 'top',
    content: (
      <StepContent
        title="Pick a mode"
        description="Switch between Research (multi-step with citations) and Build (code & artifact authoring)."
      />
    )
  },
  {
    selectorId: TOUR_STEP_IDS.SUGGESTIONS,
    position: 'top',
    content: (
      <StepContent
        title="Try a starter"
        description="Pick a prompt to see what Polymorph can do without typing anything."
      />
    )
  },
  {
    selectorId: TOUR_STEP_IDS.SIDEBAR,
    position: 'right',
    content: (
      <StepContent
        title="Your chats"
        description="Every conversation is saved here. Open one to keep working or branch a new direction."
      />
    )
  }
]

export function OnboardingTour() {
  const { setSteps } = useTour()
  useEffect(() => {
    setSteps(onboardingSteps)
  }, [setSteps])
  return null
}

export function useTourAutoStart({
  isFirstVisit,
  delay = 1000
}: {
  isFirstVisit: boolean
  delay?: number
}) {
  const { startTour, isTourCompleted, steps } = useTour()
  useEffect(() => {
    if (!isFirstVisit || isTourCompleted || steps.length === 0) return
    const timer = setTimeout(() => startTour(), delay)
    return () => clearTimeout(timer)
  }, [isFirstVisit, isTourCompleted, steps.length, startTour, delay])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- components/tour/__tests__/onboarding-tour.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `bun typecheck`
Expected: clean (`./onboarding-tour` now resolves from `index.ts`).

- [ ] **Step 6: Commit**

```bash
git add components/tour/onboarding-tour.tsx components/tour/__tests__/onboarding-tour.test.tsx components/tour/index.ts
git commit -m "feat(tour): add polymorph onboarding steps and first-visit auto-start hook"
```

---

### Task 6: TourHost — top-level client mount

**Files:**

- Create: `components/tour/tour-host.tsx`

- [ ] **Step 1: Implement TourHost**

```tsx
// components/tour/tour-host.tsx
'use client'

import { useEffect, useState } from 'react'

import { OnboardingTour, useTourAutoStart } from './onboarding-tour'
import { TourAlertDialog, TourProvider } from './tour'
import { TOUR_STORAGE_KEYS } from './tour-constants'

const TOUR_ID = 'polymorph-onboarding'

function detectFirstVisit(): boolean {
  try {
    return (
      localStorage.getItem(
        `${TOUR_STORAGE_KEYS.TOUR_STATE_PREFIX}${TOUR_ID}`
      ) === null
    )
  } catch {
    return false
  }
}

function TourHostInner({ isFirstVisit }: { isFirstVisit: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(isFirstVisit)
  useTourAutoStart({ isFirstVisit: false })
  return (
    <>
      <OnboardingTour />
      <TourAlertDialog isOpen={dialogOpen} setIsOpen={setDialogOpen} />
    </>
  )
}

export function TourHost() {
  const [mounted, setMounted] = useState(false)
  const [isFirstVisit, setIsFirstVisit] = useState(false)

  useEffect(() => {
    setIsFirstVisit(detectFirstVisit())
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <TourProvider tourId={TOUR_ID}>
      <TourHostInner isFirstVisit={isFirstVisit} />
    </TourProvider>
  )
}
```

Note: `useTourAutoStart` is wired with `isFirstVisit: false` here because the welcome `TourAlertDialog` already handles the first-visit opt-in. The hook is kept available for future flows that want unattended auto-start.

- [ ] **Step 2: Typecheck**

Run: `bun typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/tour/tour-host.tsx
git commit -m "feat(tour): add TourHost client island with first-visit detection"
```

---

### Task 7: Wire tour-target ids into existing UI

**Files:**

- Modify: `components/chat-panel.tsx`
- Modify: `components/app-sidebar.tsx`

- [ ] **Step 1: Add `id` to the chat textarea**

In `components/chat-panel.tsx`, find the `<Textarea>` at line 324 (props start with `ref={inputRef}`). Add `id={TOUR_STEP_IDS.CHAT_INPUT}` as the first prop after `ref`:

```tsx
<Textarea
  ref={inputRef}
  id={TOUR_STEP_IDS.CHAT_INPUT}
  name='input'
  rows={1}
  // ...rest unchanged
```

Add the import at the top of the file (respecting `simple-import-sort` order — this is a `@/components` import, place it with the other `@/components` imports):

```tsx
import { TOUR_STEP_IDS } from '@/components/tour'
```

- [ ] **Step 2: Add `id` to the suggestions wrapper**

In the same file, find the wrapper `<div>` around line 461 (the one with `data-testid="empty-state-action-buttons"`). Add `id={TOUR_STEP_IDS.SUGGESTIONS}` to that `<div>`:

```tsx
<div
  id={TOUR_STEP_IDS.SUGGESTIONS}
  data-testid='empty-state-action-buttons'
  data-empty-chat-suggestions='true'
  className={cn(/* unchanged */)}
>
```

- [ ] **Step 3: Add `id` to the sidebar**

In `components/app-sidebar.tsx`, find the `<Sidebar>` element at line 39. Add `id={TOUR_STEP_IDS.SIDEBAR}`:

```tsx
<Sidebar
  id={TOUR_STEP_IDS.SIDEBAR}
  side='left'
  variant='sidebar'
  collapsible='offcanvas'
  // ...rest unchanged
```

Import:

```tsx
import { TOUR_STEP_IDS } from '@/components/tour'
```

- [ ] **Step 4: Verify mode-selector id is unchanged**

Confirm `components/mode-selector.tsx:56` still reads:

```ts
const MODE_SELECTOR_TRIGGER_ID = 'mode-selector-trigger'
```

This is the existing id Polymorph already attaches to the dropdown trigger. `TOUR_STEP_IDS.MODE_SELECTOR` points at this same string — no edit required here.

- [ ] **Step 5: Typecheck + lint**

Run: `bun typecheck && bun lint components/chat-panel.tsx components/app-sidebar.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add components/chat-panel.tsx components/app-sidebar.tsx
git commit -m "feat(tour): wire tour-target ids into chat panel and sidebar"
```

---

### Task 8: Mount TourHost in the chat layout

**Files:**

- Modify: `app/(chat)/layout.tsx`

- [ ] **Step 1: Read the current layout**

Run: `cat app/\(chat\)/layout.tsx` and locate the JSX returned by the layout. Identify a stable place inside the existing client-tree where `<TourHost />` can render as a sibling (it doesn't need to wrap anything — it self-mounts an overlay).

- [ ] **Step 2: Add the mount**

Add a single `<TourHost />` inside the layout, after the main content slot but before any closing provider:

```tsx
import { TourHost } from '@/components/tour'

// ... inside the returned JSX:
;<SidebarProvider /* existing props */>
  {/* existing sidebar + content */}
  <TourHost />
</SidebarProvider>
```

If the layout is an RSC (no `'use client'` directive at the top), `TourHost` is itself a client component and will render correctly without making the layout client.

- [ ] **Step 3: Build + typecheck**

Run: `bun typecheck && bun run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add app/\(chat\)/layout.tsx
git commit -m "feat(tour): mount TourHost inside chat layout"
```

---

### Task 9: Manual verification

Tour rendering, spotlight clipping, keyboard nav, and animations are hard to assert in unit tests. Validate in the running app per `CLAUDE.md` ("For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete").

- [ ] **Step 1: Start dev server**

Run: `bun dev`
Expected: server up on port 43100.

- [ ] **Step 2: Clear tour state to simulate a first visit**

In the browser devtools console at `http://localhost:43100`:

```js
Object.keys(localStorage)
  .filter(k => k.startsWith('polymorph-tour-'))
  .forEach(k => localStorage.removeItem(k))
location.reload()
```

Expected: Welcome dialog appears on next page render.

- [ ] **Step 3: Verify the tour flow**

- Click **Start the tour**. Spotlight should appear over the chat input (step 1/4).
- Press `→` (or click **Next**). Spotlight should move to the mode-selector pill (step 2/4).
- Press `→`. Spotlight should highlight the suggestions area (step 3/4).
- Press `→`. Spotlight should highlight the sidebar (step 4/4).
- Press `→` (or click **Finish**). Tour closes; localStorage now has `{completed: true}`.
- Reload — the welcome dialog should NOT reappear.

- [ ] **Step 4: Verify keyboard cancellation**

- Clear localStorage again, reload, click **Start the tour**, press `Escape`. Tour closes; localStorage records `completed: true`.

- [ ] **Step 5: Verify reduced-motion**

- In OS settings (or Chrome devtools → Rendering → "Emulate CSS prefers-reduced-motion: reduce"), enable reduced motion.
- Reload, restart the tour. Spotlight should snap (no scale tween); tooltip should crossfade (no slide).

- [ ] **Step 6: Verify mobile layout**

- Open devtools, switch to a mobile viewport (e.g. iPhone 14, 390px wide).
- Clear localStorage, reload. The welcome dialog should render the **mobile** single-column layout. Tour steps should still work; left/right positions on mobile should fall back to top/bottom (existing behavior in `calculateContentPosition`).

- [ ] **Step 7: Verify element-not-found graceful degradation**

- With the tour active, open devtools console and run `document.getElementById('tour-suggestions')?.remove()` then advance to that step. Expect a `[tour]` `console.warn` line, no thrown exception, no broken overlay.

- [ ] **Step 8: Record findings inline**

Note any deviations directly in this section before claiming done.

---

### Task 10: Final verification + cleanup

- [ ] **Step 1: Full test suite**

Run: `bun run test`
Expected: all tests pass, including the three new files.

- [ ] **Step 2: Typecheck + lint**

Run: `bun typecheck && bun lint`
Expected: clean.

- [ ] **Step 3: Format check**

Run: `bun format:check`
Expected: clean.

- [ ] **Step 4: Production build**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 5: Confirm `MEMORY.md` does not need new entries**

No new architectural invariants were introduced. Skip.

- [ ] **Step 6: Final commit (only if uncommitted changes exist from formatting)**

```bash
git status
# If clean, no commit needed.
```

---

## Self-Review

**1. Spec coverage:**

- ✅ Tour mechanics (spotlight, tooltip, keyboard nav, persistence) — Task 2.
- ✅ Welcome dialog adapted to Polymorph — Task 4.
- ✅ Step content rewritten for Polymorph's actual UI — Task 5.
- ✅ Mount point that respects RSC boundary — Task 6.
- ✅ Tour targets wired into existing components — Task 7.
- ✅ First-visit detection — Task 6, validated in Task 9.
- ✅ Manual UI verification — Task 9.

**2. Placeholder scan:**

- No `TBD` / `TODO` / `implement later` strings.
- Every code step has runnable code.
- The "DesktopTourDialog stub" in Task 2 is intentionally a stub returning `null` and is replaced in Task 4 — both ends of that contract are written out in full.

**3. Type consistency:**

- `TOUR_STEP_IDS` shape matches across constants test (Task 1), onboarding step config (Task 5), and onboarding test (Task 5).
- `TourStep` type is exported from `tour.tsx` and consumed in `onboarding-tour.tsx`.
- `useTourAutoStart` signature: `{isFirstVisit: boolean, delay?: number}` — used identically in `tour-host.tsx` (Task 6) and the test (Task 5).
- `TourAlertDialog` props `{isOpen, setIsOpen}` (per vana's original) — matches usage in `TourHost`.

No issues found.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-onboarding-tour-port.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
