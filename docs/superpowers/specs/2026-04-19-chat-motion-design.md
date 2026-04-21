# Chat Motion — Research & Build Flow

**Date:** 2026-04-19
**Scope:** Add subtle entrance/exit motion to mode pills, tool UI cards, and timeline events in the chat surface. Research and build modes only (Radix-animated primitives, canvas panel, and message bubbles are explicitly out of scope).
**Status:** Implemented in the current chat surface.

---

## Decision Summary

| Area              | Decision                                                                                                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope             | Mode pills (`components/mode-selector.tsx`), all 13 registered tool UI cards (`components/tool-ui/registry.tsx`), and `displayTimeline`'s internal event stagger.                                                                                                     |
| Motion vocabulary | Fade + 8px translateY rise, ease-out, 200ms entrance / 140ms exit / 50ms stagger between siblings.                                                                                                                                                                    |
| Coverage          | Uniform: every entry in `components/tool-ui/registry.tsx` (9 `display*` outputs, `generateImage`, and 3 canvas-artifact cards — 13 total) gets the same entrance primitive.                                                                                           |
| Library           | `motion/react` (Framer Motion v12), already installed (`package.json:81`) and in use by `voice/voice-orb.tsx`.                                                                                                                                                        |
| Architecture      | Three shared wrappers (`ToolCardMount`, `PillPresence`, `StaggerList`) backed by a tokens file, a variants file, and a hydration-boundary context. Direct `motion/react` imports are blocked for most consumers, with an explicit exception for `components/voice/*`. |
| Reduced-motion    | Honor `prefers-reduced-motion: reduce` with true zero-motion — no fade, no translate, no stagger, no exit. `initial={false}` on the hydration path (see SSR handling) prevents any flash without requiring motion. Matches WCAG 2.3.3.                                |
| SSR / hydration   | `isNew` prop on `ToolCardMount`, resolved via a client-side `HydrationAnimationProvider` that snapshots initial tool-part IDs once at first render. Streamed / optimistic parts animate; SSR history paints instantly.                                                |
| Out of scope      | Canvas panel (already `transition-all duration-300`), Radix dialogs/sheets/popovers/tooltips, message bubbles, dropdown menus, alert dialogs.                                                                                                                         |

---

## Motion Tokens

Single source of truth at `lib/motion/tokens.ts`.

```ts
export const motionTokens = {
  duration: {
    entrance: 0.2, // 200ms — tool cards, pill-in
    exit: 0.14, // 140ms — pill-out, decisive
    stagger: 0.05 // 50ms  — timeline child delay
  },
  distance: {
    rise: 8 // px, translateY start
  },
  ease: {
    out: [0.22, 1, 0.36, 1] as const, // harmonizes with canvas panel's `ease-out`
    in: [0.64, 0, 0.78, 0] as const // sharper exit
  }
} as const
```

**Rationale:**

- The 200 / 140 / 50 ms triple is the load-bearing tempo. Entrance (200ms) stays below the canvas panel's 300ms baseline so no new motion feels slower than existing motion. Exit is deliberately faster (~30% shorter) — entrance invites attention, exit should feel decisive, not lingering.
- Cubic-bezier arrays (not Framer's named `"easeOut"`) because Framer's named curves differ subtly from CSS `ease-out`. Using the bezier form makes Framer motion visually identical to the canvas panel's CSS transition, preventing "off-by-a-hair" inconsistency.
- 8px rise (entrance) / 4px rise (exit) — exits should _recede_, not _flee_. Full-distance exits read as escape; half-distance reads as settling.

## Variants

At `lib/motion/variants.ts`:

```ts
import { motionTokens as t } from './tokens'

export const cardEntrance = {
  initial: { opacity: 0, y: t.distance.rise },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: t.duration.entrance, ease: t.ease.out }
  }
}

export const pillPresence = {
  initial: { opacity: 0, y: t.distance.rise },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: t.duration.entrance, ease: t.ease.out }
  },
  exit: {
    opacity: 0,
    y: t.distance.rise * 0.5,
    transition: { duration: t.duration.exit, ease: t.ease.in }
  }
}

export const staggerParent = {
  animate: { transition: { staggerChildren: t.duration.stagger } }
}

export const staggerChild = cardEntrance // deliberately the same as tool cards
```

Timeline children reuse `cardEntrance` verbatim so the system reads as one vocabulary at two scales of orchestration.

## Reduced-motion resolver

When the OS/browser requests reduced motion, every variant collapses to a zero-duration identity — no opacity fade, no translate, no stagger, no exit. Users with vestibular disorders who set `prefers-reduced-motion: reduce` are telling us they can't tolerate motion; honoring that literally is the WCAG 2.3.3 and W3C WAI expectation. The hydration-flash concern is handled independently by `initial={false}` on the SSR path, so we don't need a fade as a substitute.

```ts
import { useReducedMotion } from 'motion/react'

// Identity variant: no initial animation, no transition duration, no exit.
const identity = {
  initial: false as const,
  animate: { opacity: 1, y: 0, transition: { duration: 0 } }
}

export function useResolvedVariants() {
  const reduce = useReducedMotion()
  if (!reduce)
    return { cardEntrance, pillPresence, staggerParent, staggerChild }
  return {
    cardEntrance: identity,
    pillPresence: { ...identity, exit: { transition: { duration: 0 } } },
    staggerParent: { animate: { transition: { staggerChildren: 0 } } },
    staggerChild: identity
  }
}
```

The three wrappers consume `useResolvedVariants()` — no consumer branches on `prefers-reduced-motion` directly. An ESLint `no-restricted-imports` rule blocks direct `motion/react` imports outside `lib/motion/*`, `components/motion/*`, and the existing `components/voice/*` exception to enforce this at review time rather than prose.

---

## Architecture

```
lib/motion/
  tokens.ts               single constant export, no React dependency
  variants.ts             Framer variants built from tokens; exports useResolvedVariants()
  hydration-boundary.tsx  <HydrationAnimationProvider> + useIsNewPart(partId)

components/motion/
  tool-card-mount.tsx  <ToolCardMount isNew={boolean}>{children}</ToolCardMount>
  pill-presence.tsx    <PillPresence activeKey={mode}>{pillElement}</PillPresence>
  stagger-list.tsx     <StaggerList>{items}</StaggerList>  — handles long-timeline cap logic
```

**Consumers touched:**

1. `components/chat.tsx` — mount `<HydrationAnimationProvider>` at the chat root, seeded with the set of tool-part IDs present in `initialMessages` at first render. This provider is the single source of truth for `isNew` resolution across the subtree.
2. `components/tool-ui/registry.tsx` — **13 call-site edits**, one per registered entry. Inside each `tryRender` return, nest a `<ToolCardMount partId={…}>` as a child of the existing `<ToolErrorBoundary>` wrapper (order: `ToolErrorBoundary → ToolCardMount → content`). `ToolCardMount` resolves `isNew` internally via `useIsNewPart(partId)`; call-sites never touch the hydration boundary directly. The three canvas-artifact entries currently use `tryRenderCanvasArtifactCard(output)` as a shorthand — those are adapted either by wrapping the returned element inside `tryRenderCanvasArtifactCard`, or by unfolding each entry inline.
3. `components/mode-selector.tsx` — wrap active-pill branch in `<PillPresence>`; keep `transition-colors` for the blue → amber accent shift layered on top of Framer's opacity/translate.
4. `components/tool-ui/timeline/timeline.tsx` — swap the event `<ol>` root for `<StaggerList>` (note: the current element is `<ol>`, not `<ul>`; preserve ordered-list semantics).

**Untouched by design:** canvas panel's existing 300ms width+opacity transition, Radix `data-[state=open]:animate-in` animations, message bubble streaming, dropdown entrances, alert dialogs.

---

## Per-element behavior

### Mode pills (`components/mode-selector.tsx`)

- Wrap active-pill render branch in `<AnimatePresence mode="popLayout">` keyed by `mode`.
- Active pill = `<motion.div variants={pillPresence} initial animate exit>`.
- Accent color shift (`--accent-blue` → `--accent-amber`) remains as `transition-colors` CSS. Framer owns opacity+translate; Tailwind owns color.
- X-click triggers unmount → exit variant plays (140ms) → removed from DOM.
- Inactive ellipsis trigger button is untouched.

**Mode switch semantics:** research → build does **not** cross-fade both pills simultaneously. `popLayout` ensures the outgoing pill exits before or during the incoming pill's entrance, reading as a baton hand-off, not a blink.

### Tool UI cards (`components/tool-ui/registry.tsx`)

- Each of the 13 registered entries edits its `tryRender` return JSX to nest `<ToolCardMount partId={…}>` inside the existing `<ToolErrorBoundary>` wrapper.
- Implementation: `<motion.div variants={cardEntrance} initial={isNew ? 'initial' : false} animate="animate">` — no exit (tool cards persist in history).
- `ToolErrorBoundary` stays **outside** the motion wrapper. Errors do not animate in — urgent information should not wait for aesthetics. The same principle covers loading skeletons, streaming indicators, and retry toasts: if we later introduce any of those inside a tool card, they render outside the `<ToolCardMount>` boundary too.
- **No plan.tsx root-class cleanup.** The spec previously claimed `motion-safe:animate-in fade-in-0 slide-in-from-bottom-2` was on `plan.tsx`'s root; verification showed those classes live on individual `<PlanTodoItem>` elements and status icons, not the root `<Card>`. The item-level and icon-level animations in `plan.tsx` are orthogonal to card-level entrance and are left untouched in this spec.

**Ordering inside the wrapper stack:**

```
ToolErrorBoundary
  └── ToolCardMount
        └── <the tool's own content>
```

**Focus-management note.** A `translateY(8px → 0)` entrance on an ancestor moves any focused descendant pixel-aligned with the transform, which is correct by design but can look jittery on custom focus-ring implementations. `motion.div` sets `will-change: transform, opacity` automatically during the animation and clears it after, which keeps compositing on the GPU and avoids subpixel jitter in common cases. No consumer action required.

### Timeline event stagger (`components/tool-ui/timeline/timeline.tsx`)

- Event `<ol>` → `<motion.ol variants={staggerParent} initial animate>` (the element is an ordered list in code; keep `<ol>` semantics).
- Each `<li>` → `<motion.li variants={staggerChild}>`.
- **Long-timeline cap** (implemented inside `StaggerList`): items 1–10 use normal `staggerChildren: 0.05`; items 11+ all receive `transition: { delay: 0.5 }` so they enter as a block at the 500ms mark instead of cascading indefinitely. Prevents 30-event timelines from feeling sluggish.

---

## SSR / hydration handling

Framer's `motion.div` with `initial` set renders with `opacity: 0` on the server. Without mitigation, loading a chat from history would flash blank cards.

**Strategy:** `ToolCardMount` resolves `isNew` internally; call-sites only pass a stable `partId`.

- `isNew={true}` → newly streamed or optimistically inserted → `initial="initial"` → animates in.
- `isNew={false}` → present at initial hydration → `initial={false}` → paints fully opaque immediately.

**Mechanism.** A client-only `HydrationAnimationProvider` is mounted at the chat root inside `components/chat.tsx`. On first render it captures the set of tool-part IDs present in `initialMessages` using a `useState` initializer, which runs exactly once. `ToolCardMount` calls `useIsNewPart(partId)` and derives `isNew` by checking absence from that snapshot set. The snapshot is frozen for the lifetime of the provider — new messages that arrive later are, by definition, _new_.

```tsx
// lib/motion/hydration-boundary.tsx
const HydrationSnapshot = createContext<ReadonlySet<string>>(new Set())

export function HydrationAnimationProvider({
  initialPartIds,
  children
}: {
  initialPartIds: string[]
  children: ReactNode
}) {
  // Captured once on first client render; never updated.
  const [seen] = useState(() => new Set(initialPartIds))
  return (
    <HydrationSnapshot.Provider value={seen}>
      {children}
    </HydrationSnapshot.Provider>
  )
}

export function useIsNewPart(partId: string): boolean {
  const seen = useContext(HydrationSnapshot)
  return !seen.has(partId)
}
```

The provider is a client component; its `useState` initializer runs during hydration, so the set reflects the exact tool-parts the server rendered. Parts added to React state after that point — whether via the streaming reducer in `lib/streaming/helpers/prepare-tool-result-messages.ts` or via an optimistic client insert — are not in the set and therefore read as new.

**Contract (by case):**

| Case                                            |                 `isNew`                  | Why                                                                                       |
| ----------------------------------------------- | :--------------------------------------: | ----------------------------------------------------------------------------------------- |
| Part rendered from SSR `initialMessages`        |                 `false`                  | ID is in the snapshot set.                                                                |
| Part streamed in after hydration (SSE)          |                  `true`                  | ID was not in the snapshot.                                                               |
| Part inserted optimistically by a client action |                  `true`                  | Same as SSE: arrived after hydration.                                                     |
| bfcache restore (`pageshow` with `persisted`)   |                 `false`                  | React reuses the hydrated tree; snapshot is unchanged. Restored parts still read as seen. |
| Mid-stream reload                               |                  mixed                   | Parts already SSR'd are `false`; parts that resume streaming after reload are `true`.     |
| Navigation between chats (route change)         | `false` for the new chat's initial parts | The provider re-mounts with a fresh snapshot per chat.                                    |

This matches the user's stated intent ("when user selects, closes etc." — interaction-triggered, not page-load-triggered) and avoids the "every navigation replays 20 animations" anti-pattern.

**Prerequisite:** every tool-part rendered through the registry must have a stable `partId`. The message-part objects threaded through `render-message.tsx` already carry an `id` field; confirm during implementation that it is plumbed into the registry call-site. If any entry lacks a stable id, that gap is in-scope for this spec — without it, `isNew` resolution is unreliable.

---

## Testing

### Unit (Vitest)

- `lib/motion/tokens.test.ts` — snapshot the tokens object to prevent accidental drift.
- `lib/motion/hydration-boundary.test.tsx` — mount `HydrationAnimationProvider` with initial IDs `['a', 'b']`, assert `useIsNewPart('a')` → `false`, `useIsNewPart('c')` → `true`. Re-render with different `initialPartIds` prop and assert the snapshot is stable (the `useState` initializer runs once).
- `components/motion/tool-card-mount.test.tsx` — wrap in a provider seeded with `['seen-id']`; render `<ToolCardMount partId="seen-id">` and assert no initial animation; render `<ToolCardMount partId="new-id">` and assert the entrance variant plays.
- `components/motion/pill-presence.test.tsx` — renders an active pill, swaps key, asserts `AnimatePresence` wraps it and exit variant is invoked on unmount.
- `components/motion/stagger-list.test.tsx` — renders 15 items, asserts items 11–15 receive `delay: 0.5` (the cap logic).
- `lib/motion/variants.test.ts` — mock `matchMedia('(prefers-reduced-motion: reduce)')` returning true, call `useResolvedVariants()` (via React Testing Library hook harness), assert resolved variants have `initial: false` and `transition.duration: 0` for entrance, `pillPresence.exit.transition.duration: 0`, and `staggerParent.animate.transition.staggerChildren: 0`. (Asserts the true-zero-motion contract.)

### Manual / visual (webapp-testing skill)

- Chrome: load chat, toggle research → build → close pill. Record GIF of before/after for the PR description.
- Chrome DevTools → Rendering → emulate `prefers-reduced-motion: reduce`; confirm no translate motion and opacity-only transitions.
- Long-timeline scenario: seed a chat with a 25-event `displayTimeline`, confirm first 10 cascade then remainder reveal as a block at ~500ms.
- History load scenario: open a pre-existing chat with tool outputs; confirm no animation flash (the `isNew={false}` path).

### Quality gates (per CLAUDE.md)

- `bun lint` — no new warnings.
- `bun typecheck` — clean.
- `bun run test` — all suites pass.

---

## Explicit non-goals

To keep the diff surgical:

- Canvas panel slide-in/out — already has `transition-all duration-300 ease-out`. Adding Framer would double-animate.
- Radix primitives (dialog, sheet, popover, tooltip, dropdown menu, alert dialog) — `data-state` animations are already tuned.
- Message bubbles / turn rendering — streaming text has its own motion vocabulary; fade-rise on every turn would feel busy.
- The ellipsis → menu dropdown entrance — Radix handles it.
- Any motion token changes to the canvas panel's existing 300ms transition.

If any of these later prove to need motion work, they get their own spec — not a drive-by in this one.

---

## File inventory

**New:**

- `lib/motion/tokens.ts`
- `lib/motion/variants.ts`
- `lib/motion/hydration-boundary.tsx` — `HydrationAnimationProvider` + `useIsNewPart(partId)`.
- `components/motion/tool-card-mount.tsx`
- `components/motion/pill-presence.tsx`
- `components/motion/stagger-list.tsx`
- Tests colocated next to source as `*.test.ts` / `*.test.tsx`.

**Modified:**

- `components/chat.tsx` — mount `<HydrationAnimationProvider initialPartIds={…}>` at the chat root, seeded from the SSR `initialMessages`.
- `components/tool-ui/registry.tsx` — 13 call-site edits. Each `tryRender` return nests `<ToolCardMount partId={…}>` inside the existing `<ToolErrorBoundary>`. The three canvas-artifact entries that delegate to `tryRenderCanvasArtifactCard` are adapted either by wrapping inside the helper or by unfolding the entries inline — implementer's choice, verified in code review.
- `components/mode-selector.tsx` — wrap active-pill branch in `<AnimatePresence mode="popLayout">` + `<PillPresence>`. Add focus-management: on mode swap, keep focus on the stable trigger rather than letting it fall to `<body>`.
- `components/tool-ui/timeline/timeline.tsx` — swap event `<ol>` root for `<StaggerList>` (preserving ordered-list semantics).

**Intentionally not modified:**

- `components/tool-ui/plan/plan.tsx` — prior spec revision proposed removing `motion-safe:animate-in fade-in-0 slide-in-from-bottom-2` from the root element; verification showed those classes are not on the root. The item-level animations in `plan.tsx` (lines 50, 54, 64, 68, 224, 262) are orthogonal to card-level entrance and remain untouched. Harmonizing those later, if desired, is a separate spec.

**Enforcement:**

- ESLint `no-restricted-imports`: `motion/react` may only be imported from `lib/motion/*`, `components/motion/*`, and the existing `components/voice/*` exception. Prevents new consumers from drifting away from `useResolvedVariants()` while preserving the shipped voice surface.
