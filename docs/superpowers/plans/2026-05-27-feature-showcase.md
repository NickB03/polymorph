# Feature Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Polymorph-flavored feature showcase modal modeled on vana.bot's production design. First-visit users see a 4-category modal that demonstrates Polymorph's core capabilities (Chat & Search, Research, Build, Maps) with simulated browser-frame previews per category. No spotlight tour, no DOM-target highlighting.

**Why this replaces the prior spotlight tour:** PR #235 ported vana's older `src/components/tour/` shadcn-spotlight pattern. Comparing the rendered output to vana.bot's live design surfaced a fundamental mismatch — the production pattern is a feature gallery, not a UI walkthrough. The newer design isn't in the public NickB03/vana repo, so this plan rebuilds from screenshots + Polymorph's actual demo content.

**Architecture:**

- Single `'use client'` `<FeatureShowcaseHost />` island mounted inside `app/(chat)/layout.tsx`. The island gates on `localStorage` (first-visit detection) and renders nothing on the server.
- `<FeatureShowcase>` modal owns the active-category state. Left pane lists category cards; right pane renders the active preview component. Footer pager + dot indicators advance between categories. `X` close + backdrop dismissal both set `{completed: true}` in `localStorage`.
- 4 preview components (one per category). Each renders a static JSX scene inside a shared `<BrowserFrame>` (macOS-style chrome). Some previews show a chat + artifact side-by-side; others are single-pane.
- All content is static — no live LLM calls, no real artifacts. Each preview is a curated screenshot-equivalent that conveys what Polymorph produces.

**Tech Stack:** Next.js 16 App Router (RSC + client islands), React 19, TypeScript (strict), Tailwind v4, shadcn/ui (`Dialog`, `Button`), `motion@^12.39.0` (already installed), `lucide-react` for category icons, Vitest, `@testing-library/react`.

**Polymorph categories (matching demo gif coverage):**

| Category      | Icon              | Tagline (~2 lines)                                                        | Preview content                                                                                                                                                      |
| ------------- | ----------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat & Search | `Search` (Lucide) | "Ask anything and get answers grounded in real-time web search"           | Fake chat: RAG question → streamed response with source citations                                                                                                    |
| Research      | `Microscope`      | "Multi-step research with a live activity panel and inline citations"     | Fake chat: Alzheimer's resilience question → multi-section answer + Research Activity sidebar                                                                        |
| Build         | `Wand2`           | "Generate interactive HTML, React components, and full landing pages"     | Fake chat: "Build a landing page" → split-pane with chat on left + rendered landing-page mockup on right (no specific brand name on the page)                        |
| Generative UI | `LayoutGrid`      | "Tool results render as interactive maps, charts, and live UI components" | Fake chat: "Best Italian restaurants in Dallas" → split-pane with chat on left + interactive map mockup on right (maps are one concrete example of tool-rendered UI) |

---

## File structure

**New files:**

```
components/feature-showcase/
├── feature-showcase.tsx              # Main modal: orchestrates category state + layout
├── feature-showcase-host.tsx         # Client island: localStorage gate + Dialog mount
├── browser-frame.tsx                 # macOS-style window chrome
├── category-card.tsx                 # Single category in the left list
├── feature-pager.tsx                 # Bottom Previous/Next + dot indicators
├── categories.ts                     # 4 category data records
├── index.ts                          # Public exports
├── previews/
│   ├── chat-search-preview.tsx
│   ├── research-preview.tsx
│   ├── build-preview.tsx
│   └── generative-ui-preview.tsx
└── __tests__/
    ├── categories.test.ts
    ├── feature-pager.test.tsx
    └── feature-showcase.test.tsx
```

**Modified files:**

- `app/(chat)/layout.tsx` — mount `<FeatureShowcaseHost />` inside the existing layout tree, next to `<CanvasRoot />`
- `vitest.setup.ts` — add `localStorage` + `window.matchMedia` stubs (both confirmed missing in current main; ResizeObserver stub already present)

**Not modified (deliberately):**

- `eslint.config.mjs` — the showcase code never imports from `motion/react`, so the `no-restricted-imports` override does not need a new entry. If motion-based animation is added later, add `'components/feature-showcase/**/*.{ts,tsx}'` to the `files:` array at `eslint.config.mjs:63`.

**Reused (no edit):**

- `components/ui/dialog.tsx` — shadcn `Dialog` primitives (Radix-based)
- `components/ui/button.tsx`
- `hooks/use-mobile.tsx` — `useIsMobile()` for mobile layout
- `lib/utils.ts` — `cn()` helper

---

## Preview implementation conventions

All four preview components render static screenshot-equivalent JSX scenes inside `<BrowserFrame>`. They must follow these conventions so the showcase doesn't surprise assistive tech or keyboard users:

- **No real interactive elements inside previews.** Anything that looks clickable (Send buttons, Open buttons, mode pills, CTAs) MUST be a `<span>`, NOT a `<button>`. The previews are illustrative only — they should not register as actionable for screen readers or tab key.
- **Wrap the whole right pane in `aria-hidden` where appropriate.** When a preview renders a mockup that's purely visual (the Build preview's landing page, the Generative UI preview's map), put `aria-hidden` on the wrapper so assistive tech doesn't get a stream of unstructured DOM.
- **No nested `<h2>` or `<h3>` inside DialogContent.** The sr-only `DialogTitle` is the modal's single semantic heading. Use `<div>` with text utilities instead of heading tags inside previews.

---

## Tasks

### Task 1: Category data + tests

**Files:**

- Create: `components/feature-showcase/categories.ts`
- Test: `components/feature-showcase/__tests__/categories.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// components/feature-showcase/__tests__/categories.test.ts
import { describe, expect, it } from 'vitest'

import { CATEGORIES, type Category } from '../categories'

describe('CATEGORIES', () => {
  it('exposes four polymorph categories in the order shown to users', () => {
    expect(CATEGORIES.map(c => c.id)).toEqual([
      'chat-search',
      'research',
      'build',
      'generative-ui'
    ])
  })

  it('every category has the required fields populated', () => {
    for (const c of CATEGORIES) {
      expect(c.id).toBeTruthy()
      expect(c.title).toBeTruthy()
      expect(c.description.length).toBeGreaterThan(20)
      expect(c.Icon).toBeTruthy()
    }
  })

  it('Category type matches the data shape', () => {
    const sample: Category = CATEGORIES[0]
    expect(typeof sample.id).toBe('string')
    expect(typeof sample.title).toBe('string')
    expect(typeof sample.description).toBe('string')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/feature-showcase/__tests__/categories.test.ts`
Expected: FAIL — `Cannot find module '../categories'`.

- [ ] **Step 3: Implement `categories.ts`**

```ts
// components/feature-showcase/categories.ts
import { LayoutGrid, Microscope, Search, Wand2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type CategoryId = 'chat-search' | 'research' | 'build' | 'generative-ui'

export interface Category {
  id: CategoryId
  title: string
  description: string
  Icon: LucideIcon
}

export const CATEGORIES: Category[] = [
  {
    id: 'chat-search',
    title: 'Chat & Search',
    description:
      'Ask anything and get answers grounded in real-time web search.',
    Icon: Search
  },
  {
    id: 'research',
    title: 'Research',
    description:
      'Multi-step research with a live activity panel and inline citations.',
    Icon: Microscope
  },
  {
    id: 'build',
    title: 'Build',
    description:
      'Generate interactive HTML, React components, and full landing pages.',
    Icon: Wand2
  },
  {
    id: 'generative-ui',
    title: 'Generative UI',
    description:
      'Tool results render as interactive maps, charts, and live UI components.',
    Icon: LayoutGrid
  }
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- components/feature-showcase/__tests__/categories.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add components/feature-showcase/categories.ts components/feature-showcase/__tests__/categories.test.ts
git commit -m "feat(showcase): define the four feature showcase categories"
```

---

### Task 2: Browser frame component

**Files:**

- Create: `components/feature-showcase/browser-frame.tsx`

A `<BrowserFrame>` reproduces a macOS-style window chrome: title bar with red/yellow/green traffic lights, back/forward arrows, a non-functional URL bar, and a content area that renders `children`. Used by every preview as the wrapper.

- [ ] **Step 1: Implement `browser-frame.tsx`**

```tsx
// components/feature-showcase/browser-frame.tsx
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react'

import { cn } from '@/lib/utils'

interface BrowserFrameProps {
  /** URL string shown in the address bar (e.g. "https://polymorph.ai") */
  url: string
  /** Optional className to tweak the outer wrapper (e.g. height constraints) */
  className?: string
  children: React.ReactNode
}

export function BrowserFrame({ url, className, children }: BrowserFrameProps) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl',
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-3 rounded-full bg-[#ff5f57]" aria-hidden />
          <span className="size-3 rounded-full bg-[#febc2e]" aria-hidden />
          <span className="size-3 rounded-full bg-[#28c840]" aria-hidden />
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <ArrowLeft className="size-3.5" aria-hidden />
          <ArrowRight className="size-3.5" aria-hidden />
        </div>
        <div className="flex flex-1 items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden />
          <span className="truncate">{url}</span>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden bg-background">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint + format**

Run: `bun lint components/feature-showcase/browser-frame.tsx && bun format components/feature-showcase/browser-frame.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/feature-showcase/browser-frame.tsx
git commit -m "feat(showcase): add macOS-style browser frame wrapper"
```

---

### Task 3: Category card + pager

**Files:**

- Create: `components/feature-showcase/category-card.tsx`
- Create: `components/feature-showcase/feature-pager.tsx`
- Test: `components/feature-showcase/__tests__/feature-pager.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/feature-showcase/__tests__/feature-pager.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FeaturePager } from '../feature-pager'

describe('FeaturePager', () => {
  it('renders a dot per total step', () => {
    render(
      <FeaturePager
        activeIndex={0}
        total={4}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getAllByTestId('feature-pager-dot')).toHaveLength(4)
  })

  it('marks the active dot with data-active="true"', () => {
    render(
      <FeaturePager
        activeIndex={2}
        total={4}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    )
    const dots = screen.getAllByTestId('feature-pager-dot')
    expect(dots[2].getAttribute('data-active')).toBe('true')
    expect(dots[0].getAttribute('data-active')).toBe('false')
  })

  it('disables Previous on the first step and Next on the last', () => {
    const { rerender } = render(
      <FeaturePager
        activeIndex={0}
        total={4}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()

    rerender(
      <FeaturePager
        activeIndex={3}
        total={4}
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('fires onPrev and onNext when the buttons are clicked', () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(
      <FeaturePager activeIndex={1} total={4} onPrev={onPrev} onNext={onNext} />
    )
    fireEvent.click(screen.getByRole('button', { name: /previous/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/feature-showcase/__tests__/feature-pager.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `category-card.tsx`**

```tsx
// components/feature-showcase/category-card.tsx
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface CategoryCardProps {
  title: string
  description: string
  Icon: LucideIcon
  active: boolean
  onClick: () => void
}

export function CategoryCard({
  title,
  description,
  Icon,
  active,
  onClick
}: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
        active ? 'bg-muted ring-1 ring-border' : 'hover:bg-muted/60'
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors',
          active
            ? 'border-foreground/40 text-foreground'
            : 'border-border text-muted-foreground'
        )}
      >
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            'text-sm font-medium',
            active ? 'text-foreground' : 'text-foreground/80'
          )}
        >
          {title}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  )
}
```

- [ ] **Step 4: Implement `feature-pager.tsx`**

```tsx
// components/feature-showcase/feature-pager.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FeaturePagerProps {
  activeIndex: number
  total: number
  onPrev: () => void
  onNext: () => void
}

export function FeaturePager({
  activeIndex,
  total,
  onPrev,
  onNext
}: FeaturePagerProps) {
  const atStart = activeIndex === 0
  const atEnd = activeIndex === total - 1

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={atStart}
        onClick={onPrev}
        className="gap-1"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Previous
      </Button>

      <div className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            data-testid="feature-pager-dot"
            data-active={i === activeIndex}
            className={cn(
              'size-1.5 rounded-full transition-colors',
              i === activeIndex ? 'bg-foreground' : 'bg-muted-foreground/40'
            )}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={atEnd}
        onClick={onNext}
        className="gap-1"
      >
        Next
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- components/feature-showcase/__tests__/feature-pager.test.tsx`
Expected: 4/4 PASS.

- [ ] **Step 6: Typecheck + lint + format**

```
bun typecheck
bun lint components/feature-showcase/
bun format components/feature-showcase/
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add components/feature-showcase/category-card.tsx components/feature-showcase/feature-pager.tsx components/feature-showcase/__tests__/feature-pager.test.tsx
git commit -m "feat(showcase): add category card and pager components"
```

---

### Task 4: Chat & Search preview

**Files:**

- Create: `components/feature-showcase/previews/chat-search-preview.tsx`

Renders a static fake chat inside a `<BrowserFrame>`. The user asks about RAG; the assistant streams a structured response with source citations. No live LLM calls.

- [ ] **Step 1: Implement `chat-search-preview.tsx`**

```tsx
// components/feature-showcase/previews/chat-search-preview.tsx
import { ChevronDown, Globe } from 'lucide-react'

import { BrowserFrame } from '../browser-frame'

export function ChatSearchPreview() {
  return (
    <BrowserFrame url="https://polymorph.ai" className="h-full">
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground">
              How does retrieval augmented generation (RAG) improve AI accuracy?
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div
                className="size-5 rounded-full bg-foreground/10"
                aria-hidden
              />
              <span>Polymorph</span>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
              Thought process · 4s
              <ChevronDown className="size-3" aria-hidden />
            </span>

            <p className="text-sm leading-relaxed text-foreground">
              RAG improves accuracy by shifting the model from a sole source of
              knowledge to an informed researcher. Standard LLMs rely entirely
              on their training data; a RAG pipeline retrieves fresh,
              source-grounded passages at query time and conditions the response
              on them.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                {
                  host: 'arxiv.org',
                  title:
                    'Retrieval-Augmented Generation for Knowledge-Intensive NLP'
                },
                {
                  host: 'pinecone.io',
                  title: 'What is Retrieval Augmented Generation?'
                },
                {
                  host: 'huggingface.co',
                  title: 'RAG: knowledge-grounded generation'
                },
                {
                  host: 'aws.amazon.com',
                  title: 'Why RAG reduces hallucination'
                }
              ].map(src => (
                <div
                  key={src.host}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs"
                >
                  <Globe
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {src.title}
                    </div>
                    <div className="truncate text-muted-foreground">
                      {src.host}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between rounded-full border border-border bg-background px-4 py-2.5">
            <span className="text-sm text-muted-foreground">Ask anything…</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Send
            </span>
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}
```

- [ ] **Step 2: Lint + format**

```
bun lint components/feature-showcase/previews/chat-search-preview.tsx
bun format components/feature-showcase/previews/chat-search-preview.tsx
```

- [ ] **Step 3: Commit**

```bash
git add components/feature-showcase/previews/chat-search-preview.tsx
git commit -m "feat(showcase): add chat-and-search preview scene"
```

---

### Task 5: Research preview

**Files:**

- Create: `components/feature-showcase/previews/research-preview.tsx`

A split-pane layout. Left ~70%: a fake research-mode chat with a multi-section structured answer. Right ~30%: a "Research Activity" sidebar showing the agent's intermediate web searches.

- [ ] **Step 1: Implement `research-preview.tsx`**

```tsx
// components/feature-showcase/previews/research-preview.tsx
import { Check, Search } from 'lucide-react'

import { BrowserFrame } from '../browser-frame'

const activitySteps = [
  'Search: cognitive reserve Alzheimer’s pathology',
  'Search: resilient brains in Alzheimer’s disease',
  'Search: neuroinflammation and cognitive resilience'
]

export function ResearchPreview() {
  return (
    <BrowserFrame url="https://polymorph.ai" className="h-full">
      <div className="flex h-full overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto border-r border-border">
          <div className="space-y-4 px-6 py-5">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground">
                Why do some brains with Alzheimer’s pathology stay sharp?
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                Brains with Alzheimer’s pathology that stay sharp share three
                protections
              </h3>
              <p className="text-sm leading-relaxed text-foreground">
                Some individuals harbor amyloid plaques and tau tangles yet
                maintain normal cognition — a phenomenon called{' '}
                <span className="font-medium">cognitive reserve</span> or{' '}
                <span className="font-medium">brain reserve</span>.
              </p>

              <ul className="space-y-2 text-sm leading-relaxed text-foreground">
                <li>
                  <span className="font-medium">Cognitive reserve:</span>{' '}
                  education, mental stimulation, and social engagement build
                  neural redundancy.
                </li>
                <li>
                  <span className="font-medium">
                    Reduced neuroinflammation:
                  </span>{' '}
                  resilient brains show lower microglial activation and altered
                  cytokine profiles.
                </li>
                <li>
                  <span className="font-medium">Cellular protections:</span>{' '}
                  preserved mitochondrial function and ongoing neuron growth in
                  “superagers.”
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between rounded-full border border-border bg-background px-4 py-2.5">
              <span className="text-sm text-muted-foreground">
                Ask anything…
              </span>
              <span className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
                Research
              </span>
            </div>
          </div>
        </div>

        <aside className="hidden w-56 shrink-0 flex-col bg-muted/30 md:flex">
          <div className="border-b border-border px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Research Activity
          </div>
          <ul className="flex-1 space-y-2 px-3 py-3 text-xs">
            {activitySteps.map(step => (
              <li key={step} className="flex items-start gap-2 text-foreground">
                <Check
                  className="mt-0.5 size-3.5 shrink-0 text-foreground/70"
                  aria-hidden
                />
                <span className="leading-snug">{step}</span>
              </li>
            ))}
            <li className="flex items-start gap-2 text-muted-foreground">
              <Search
                className="mt-0.5 size-3.5 shrink-0 animate-pulse"
                aria-hidden
              />
              <span className="leading-snug">Synthesizing findings…</span>
            </li>
          </ul>
        </aside>
      </div>
    </BrowserFrame>
  )
}
```

- [ ] **Step 2: Lint + format + commit**

```
bun lint components/feature-showcase/previews/research-preview.tsx
bun format components/feature-showcase/previews/research-preview.tsx
git add components/feature-showcase/previews/research-preview.tsx
git commit -m "feat(showcase): add research preview scene with activity sidebar"
```

---

### Task 6: Build preview

**Files:**

- Create: `components/feature-showcase/previews/build-preview.tsx`

Split-pane: left shows a chat where the user asks Polymorph to build a landing page; right shows the rendered landing page mockup ("VibeStack" hero with a CTA). The split mirrors Polymorph's canvas behavior.

- [ ] **Step 1: Implement `build-preview.tsx`**

```tsx
// components/feature-showcase/previews/build-preview.tsx
import { ExternalLink, FileCode2 } from 'lucide-react'

import { BrowserFrame } from '../browser-frame'

export function BuildPreview() {
  return (
    <BrowserFrame url="https://polymorph.ai" className="h-full">
      <div className="flex h-full overflow-hidden">
        <div className="flex w-2/5 min-w-0 flex-col border-r border-border">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex justify-end">
              <div className="max-w-[90%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground">
                Build a modern, responsive landing page with a hero section,
                features grid, and CTA.
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-foreground">
                I’ve built a modern landing page — hero, feature grid, and a CTA
                — fully responsive with a dark theme.
              </p>

              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                  <FileCode2
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    Vibrant Modern Landing Page
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Canvas · Interactive
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium">
                  Open <ExternalLink className="size-3" aria-hidden />
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-card px-3 py-3">
            <div className="flex items-center justify-between rounded-full border border-border bg-background px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Ask anything…
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Build
              </span>
            </div>
          </div>
        </div>

        {/* Generic landing page — no fictional brand name. The mark is an abstract gradient square. */}
        <div
          className="relative flex-1 overflow-hidden bg-[#0b0b14]"
          aria-hidden
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-gradient-to-br from-indigo-400 to-purple-500" />
              <span className="text-sm font-semibold">Landing Page</span>
            </div>
            <div className="hidden gap-4 text-xs text-white/70 md:flex">
              <span>Features</span>
              <span>Pricing</span>
              <span>Docs</span>
              <span className="rounded-md bg-white px-3 py-1 font-medium text-[#0b0b14]">
                Sign Up
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center px-6 py-8 text-center">
            <span className="mb-4 rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-white/80">
              Now with AI-powered workflows
            </span>
            <div className="text-2xl font-bold text-white md:text-3xl">
              Ship Faster with{' '}
              <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                Playful Precision
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm text-white/70">
              A modern landing page generated as a canvas artifact — fully
              responsive, dark-themed, and editable in place.
            </p>
            <div className="mt-5 flex gap-3">
              <span className="rounded-md bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-medium text-white">
                Get Started Free →
              </span>
              <span className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white">
                Watch Demo
              </span>
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}
```

- [ ] **Step 2: Lint + format + commit**

```
bun lint components/feature-showcase/previews/build-preview.tsx
bun format components/feature-showcase/previews/build-preview.tsx
git add components/feature-showcase/previews/build-preview.tsx
git commit -m "feat(showcase): add build preview with rendered landing-page mockup"
```

---

### Task 7: Generative UI preview (map example)

**Files:**

- Create: `components/feature-showcase/previews/generative-ui-preview.tsx`

This category showcases tool-result-driven generative UI broadly. A live map of restaurants is the most concrete and visually compelling example Polymorph has shipped, so the preview content uses it. The category description ("Tool results render as interactive maps, charts, and live UI components") signals to the user that maps are one example, not the whole category.

Split-pane: left shows a chat where the user asks for restaurants; right shows a stylized map mockup with pins. The map itself is a CSS-only mockup (gradient + grid + positioned pin elements) — no real map library.

- [ ] **Step 1: Implement `generative-ui-preview.tsx`**

```tsx
// components/feature-showcase/previews/generative-ui-preview.tsx
import { MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'

import { BrowserFrame } from '../browser-frame'

const pins = [
  { label: 'Bishop Arts', x: 22, y: 60 },
  { label: 'Knox-Henderson', x: 55, y: 35 },
  { label: 'Deep Ellum', x: 70, y: 55 },
  { label: 'Lower Greenville', x: 80, y: 30 },
  { label: 'Uptown', x: 45, y: 25 }
]

export function GenerativeUIPreview() {
  return (
    <BrowserFrame url="https://polymorph.ai" className="h-full">
      <div className="flex h-full overflow-hidden">
        <div className="flex w-2/5 min-w-0 flex-col border-r border-border">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex justify-end">
              <div className="max-w-[90%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground">
                What are the best Italian restaurants in Dallas, TX?
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                Best Italian in Dallas
              </h3>
              <p className="text-sm leading-relaxed text-foreground">
                Dallas has a deep Italian scene — Bishop Arts mainstays, Lower
                Greenville wood-fired concepts, and new Knox-Henderson tasting
                menus.
              </p>
              <ul className="space-y-1.5 text-sm leading-relaxed text-foreground">
                <li>
                  <span className="font-medium">Lucia</span> · Bishop Arts ·
                  seasonal pastas
                </li>
                <li>
                  <span className="font-medium">Partenope Ristorante</span> ·
                  Downtown · Neapolitan
                </li>
                <li>
                  <span className="font-medium">Carbone</span> · Knox-Henderson
                  · NYC import
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border bg-card px-3 py-3">
            <div className="flex items-center justify-between rounded-full border border-border bg-background px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Ask anything…
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Research
              </span>
            </div>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
            aria-hidden
          />
          {pins.map(pin => (
            <div
              key={pin.label}
              className={cn(
                'absolute flex -translate-x-1/2 -translate-y-full flex-col items-center'
              )}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            >
              <span className="rounded-md bg-foreground px-2 py-0.5 text-[10px] font-medium text-background shadow-sm">
                {pin.label}
              </span>
              <MapPin
                className="size-5 fill-red-500 stroke-red-700 drop-shadow-sm"
                aria-hidden
              />
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  )
}
```

- [ ] **Step 2: Lint + format + commit**

```
bun lint components/feature-showcase/previews/generative-ui-preview.tsx
bun format components/feature-showcase/previews/generative-ui-preview.tsx
git add components/feature-showcase/previews/generative-ui-preview.tsx
git commit -m "feat(showcase): add generative-ui preview with map example"
```

---

### Task 8: FeatureShowcase modal (orchestrator) + tests

**Files:**

- Create: `components/feature-showcase/feature-showcase.tsx`
- Test: `components/feature-showcase/__tests__/feature-showcase.test.tsx`

The orchestrator owns active-category state, renders the left category list + right preview pane + bottom pager + close button. It uses shadcn's `Dialog` for the modal shell so we get backdrop, focus trap, and Escape handling for free.

- [ ] **Step 1: Write the failing test**

```tsx
// components/feature-showcase/__tests__/feature-showcase.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FeatureShowcase } from '../feature-showcase'

describe('FeatureShowcase', () => {
  it('renders all four category titles', () => {
    render(<FeatureShowcase open onOpenChange={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: /chat & search/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^research/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^build/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /generative ui/i })
    ).toBeInTheDocument()
  })

  it('starts on Chat & Search and advances with Next', () => {
    render(<FeatureShowcase open onOpenChange={vi.fn()} />)
    const chatButton = screen.getByRole('button', { name: /chat & search/i })
    expect(chatButton.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    const researchButton = screen.getByRole('button', { name: /^research/i })
    expect(researchButton.getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking a category card jumps directly to that preview', () => {
    render(<FeatureShowcase open onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /generative ui/i }))
    const target = screen.getByRole('button', { name: /generative ui/i })
    expect(target.getAttribute('aria-pressed')).toBe('true')
  })

  it('resets activeIndex to 0 when the dialog reopens', () => {
    const { rerender } = render(<FeatureShowcase open onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /generative ui/i }))
    expect(
      screen
        .getByRole('button', { name: /generative ui/i })
        .getAttribute('aria-pressed')
    ).toBe('true')

    rerender(<FeatureShowcase open={false} onOpenChange={vi.fn()} />)
    rerender(<FeatureShowcase open onOpenChange={vi.fn()} />)
    expect(
      screen
        .getByRole('button', { name: /chat & search/i })
        .getAttribute('aria-pressed')
    ).toBe('true')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/feature-showcase/__tests__/feature-showcase.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `feature-showcase.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog'

import { CATEGORIES, type CategoryId } from './categories'
import { CategoryCard } from './category-card'
import { FeaturePager } from './feature-pager'
import { BuildPreview } from './previews/build-preview'
import { ChatSearchPreview } from './previews/chat-search-preview'
import { GenerativeUIPreview } from './previews/generative-ui-preview'
import { ResearchPreview } from './previews/research-preview'

interface FeatureShowcaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PreviewComponent = React.ComponentType<Record<string, never>>

const PREVIEW_BY_ID: Record<CategoryId, PreviewComponent> = {
  'chat-search': ChatSearchPreview,
  research: ResearchPreview,
  build: BuildPreview,
  'generative-ui': GenerativeUIPreview
}

export function FeatureShowcase({ open, onOpenChange }: FeatureShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  // Reset to the first category every time the modal opens so returning users start fresh.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing transient view state to the open transition
      setActiveIndex(0)
    }
  }, [open])

  const active = CATEGORIES[activeIndex]
  const Preview = PREVIEW_BY_ID[active.id]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[720px] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">See what Polymorph can do</DialogTitle>
        <DialogDescription className="sr-only">
          Browse Polymorph’s core capabilities — chat with search, multi-step
          research, canvas artifacts, and tool-driven generative UI.
        </DialogDescription>

        {/* Visible header — present at every breakpoint, paired with the sr-only DialogTitle for assistive tech */}
        <div className="border-b border-border px-5 py-3">
          <div className="text-base font-semibold text-foreground">
            See what Polymorph can do
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-72 shrink-0 flex-col gap-1.5 border-r border-border bg-muted/20 p-4 md:flex">
            {CATEGORIES.map((c, i) => (
              <CategoryCard
                key={c.id}
                title={c.title}
                description={c.description}
                Icon={c.Icon}
                active={i === activeIndex}
                onClick={() => setActiveIndex(i)}
              />
            ))}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col p-4">
            <div className="flex-1 overflow-hidden rounded-lg">
              <Preview />
            </div>
          </div>
        </div>

        <FeaturePager
          activeIndex={activeIndex}
          total={CATEGORIES.length}
          onPrev={() => setActiveIndex(i => Math.max(0, i - 1))}
          onNext={() =>
            setActiveIndex(i => Math.min(CATEGORIES.length - 1, i + 1))
          }
        />
      </DialogContent>
    </Dialog>
  )
}

/*
 * Mobile note: the category aside is hidden below `md`. On phones, users navigate categories
 * exclusively via the Previous/Next pager. The visible header above remains at all breakpoints.
 *
 * shadcn `Dialog` auto-renders an X close button at top-right via `DialogPrimitive.Close` inside
 * `components/ui/dialog.tsx`. We keep it — it matches the reference design's close affordance.
 */
```

- [ ] **Step 4: Run tests, fix anything that doesn't match the test expectations**

Run: `bun run test -- components/feature-showcase/__tests__/feature-showcase.test.tsx`
Expected: 4/4 PASS.

- [ ] **Step 5: Typecheck + lint + format**

```
bun typecheck
bun lint components/feature-showcase/
bun format components/feature-showcase/feature-showcase.tsx
```

- [ ] **Step 6: Commit**

```bash
git add components/feature-showcase/feature-showcase.tsx components/feature-showcase/__tests__/feature-showcase.test.tsx
git commit -m "feat(showcase): orchestrate categories + previews in dialog modal"
```

---

### Task 9: Index + host (client island + first-visit gate)

**Files:**

- Create: `components/feature-showcase/index.ts`
- Create: `components/feature-showcase/feature-showcase-host.tsx`

`FeatureShowcaseHost` is the only piece the rest of the app imports. It owns the localStorage check (first-visit detection), renders `null` until mounted, and wires `<FeatureShowcase>`'s `open`/`onOpenChange` to its own state.

- [ ] **Step 1: Implement `index.ts`**

```ts
// components/feature-showcase/index.ts
export { FeatureShowcase } from './feature-showcase'
export { FeatureShowcaseHost } from './feature-showcase-host'
export { CATEGORIES } from './categories'
export type { Category, CategoryId } from './categories'
```

- [ ] **Step 2: Implement `feature-showcase-host.tsx`**

```tsx
// components/feature-showcase/feature-showcase-host.tsx
'use client'

import { useEffect, useState } from 'react'

import { FeatureShowcase } from './feature-showcase'

const STORAGE_KEY = 'polymorph-showcase-seen'

function detectFirstVisit(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === null
  } catch {
    // Private browsing or storage disabled — treat as NOT a first visit so the showcase stays hidden.
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ seen: true, timestamp: Date.now() })
    )
  } catch {
    // Silently ignore — best-effort persistence.
  }
}

export function FeatureShowcaseHost() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical client-mount gate; runs exactly once after first paint to enable localStorage reads safely
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opens modal on first visit after the mount gate confirms localStorage is available
    if (detectFirstVisit()) setOpen(true)
  }, [mounted])

  if (!mounted) return null

  return (
    <FeatureShowcase
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) markSeen()
      }}
    />
  )
}
```

- [ ] **Step 3: Typecheck + lint**

```
bun typecheck
bun lint components/feature-showcase/
```

- [ ] **Step 4: Commit**

```bash
git add components/feature-showcase/feature-showcase-host.tsx components/feature-showcase/index.ts
git commit -m "feat(showcase): add client island host with first-visit gate"
```

---

### Task 10: Infrastructure + layout mount

**Files:**

- Modify: `vitest.setup.ts` (confirmed needs both stubs)
- Modify: `app/(chat)/layout.tsx`

> No `eslint.config.mjs` change is needed. The showcase code never imports from `motion/react`, so the `no-restricted-imports` override does not need to be extended. (If you later add motion-based animation, add `'components/feature-showcase/**/*.{ts,tsx}'` to the `files:` array at `eslint.config.mjs:63`. Not in scope here.)

- [ ] **Step 1: Add stubs to `vitest.setup.ts`**

`vitest.setup.ts` currently has only a `ResizeObserver` stub. Both `localStorage` and `window.matchMedia` are missing in the jsdom environment, and the new tests in this plan require them. Append these guarded stubs to the bottom of the file (they install only if absent, so future tests that depend on the same globals see consistent behavior):

```ts
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      get length() {
        return store.size
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null
    }
  })
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null
    })
  })
}
```

- [ ] **Step 2: Mount in `app/(chat)/layout.tsx`**

`app/(chat)/layout.tsx` is an RSC. The existing precedent is `<CanvasRoot />`, a client-island sibling rendered inside `<SidebarProvider>` after the main chat content `<div>`. Place `<FeatureShowcaseHost />` next to it — it renders its modal via Radix's `DialogPortal`, so its position in the JSX tree doesn't affect visual stacking.

Add the import (respect `simple-import-sort`):

```tsx
import { FeatureShowcaseHost } from '@/components/feature-showcase'
```

Add the element inside the layout's `<SidebarProvider>` (the exact insertion point lives next to whatever existing client islands are already there — read the file first):

```tsx
<SidebarProvider>
  {/* existing sidebar + main chat content */}
  <CanvasRoot /> {/* or other existing client islands */}
  <FeatureShowcaseHost />
</SidebarProvider>
```

- [ ] **Step 3: Build verification**

```
bun typecheck
bun run test
bun lint
bun run build
```

All four should pass.

- [ ] **Step 4: Commit**

```bash
git add vitest.setup.ts app/\(chat\)/layout.tsx
git commit -m "feat(showcase): add jsdom stubs and mount host in chat layout"
```

---

### Task 11: Browser verification

Static assertions can't catch layout regressions or visual mistakes. Validate in the running app.

- [ ] **Step 1: Start dev server**

`bun dev` — server up on port 43100.

- [ ] **Step 2: Clear storage to simulate a first visit**

In devtools console:

```js
localStorage.removeItem('polymorph-showcase-seen')
location.reload()
```

Expected: the showcase modal opens automatically.

- [ ] **Step 3: Walk through each category**

- Chat & Search preview: chat scrollable, source cards visible
- Click Next → Research preview: activity sidebar visible on the right
- Click Next → Build preview: VibeStack landing page mockup on the right
- Click Next → Maps preview: pinned-restaurant mockup on the right
- Click a category card to jump directly: verify active-state styling moves

- [ ] **Step 4: Verify dismissal**

Press Escape (or click the backdrop). The modal closes. Reload the page — the modal should NOT re-open.

- [ ] **Step 5: Mobile layout**

Open devtools, switch to mobile viewport (e.g. iPhone 14, 390px). Reload after clearing localStorage. The category list collapses (hidden on `md`); only the preview pane is visible. Pager still advances categories. Each preview adapts to the narrow width.

- [ ] **Step 6: Reduced motion**

Devtools → Rendering → "Emulate CSS prefers-reduced-motion: reduce". Reload. Modal should still open/close (no spinner-style animation in this design); content should appear without sliding.

- [ ] **Step 7: Record any deviations inline before claiming done.**

---

### Task 12: Final checks

- [ ] `bun run test` — all tests pass
- [ ] `bun typecheck` — clean
- [ ] `bun lint` — clean
- [ ] `bun format:check` — clean
- [ ] `bun run build` — production build succeeds

---

## Self-Review

**1. Spec coverage:**

- ✅ Modal shell + backdrop dismissal — Task 8 (uses shadcn Dialog).
- ✅ Left category list with 4 cards + selected state — Task 3, Task 8.
- ✅ Right preview pane swapping by active category — Task 8.
- ✅ 4 preview components matching Polymorph's demo coverage — Tasks 4, 5, 6, 7.
- ✅ Bottom pager with Previous/Next + dot indicators — Task 3.
- ✅ First-visit localStorage gate — Task 9.
- ✅ SSR-safe mount — Task 9 (mount gate + null on first paint).
- ✅ Mounting point in chat layout — Task 10.
- ✅ Infrastructure (eslint override, vitest stubs) — Task 10.
- ✅ Browser verification — Task 11.
- ✅ Final lint/typecheck/build — Task 12.

**2. Placeholder scan:**

- No `TBD` / `TODO` strings.
- Each task contains the full code to write (no "implement similarly to X" hand-waves).
- Each preview ships as a single self-contained JSX scene with literal content.

**3. Type consistency:**

- `Category` / `CategoryId` defined in Task 1 and consumed in Tasks 3, 8.
- `BrowserFrameProps` defined in Task 2 used by all 4 preview tasks.
- `PREVIEW_BY_ID` in Task 8 keys match `CategoryId` union from Task 1.

**4. Design assumptions worth flagging during execution:**

- The previews use Polymorph's design tokens (`text-foreground`, `bg-muted`, etc.). Visual polish may need iteration after Task 11.
- The maps preview is a CSS-only mockup — no real map library. If the user wants a real Leaflet/Mapbox snapshot, that's a follow-up.
- The category icons (Search, Microscope, Wand2, MapPin) are best-fit guesses from Lucide. Easy to swap during browser verification.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-27-feature-showcase.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks. Same pattern as PR #235.
2. **Inline Execution** — execute tasks in this session via executing-plans skill.

**Which approach?**
