# Wordmark Animation Redesign

**Date:** 2026-04-10
**File:** `components/polymorph-wordmark.tsx`
**Scope:** Animation overhaul only — no layout, size, or structural changes

---

## Decision Summary

Replace the current per-character opacity typewriter animation with a whole-word slot reel (F3b) that is more fluid, decisive, and premium.

| Property           | Before                                            | After                                                                    |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Animation style    | Per-character, 70ms stagger, opacity only         | Whole word as single unit (slot reel)                                    |
| Enter keyframe     | `opacity: 0 → 1`, linear                          | `translateY(52px) → overshoot −1.5px → settle 0`, linear timing function |
| Exit keyframe      | `opacity: 1 → 0`, linear, reverse stagger         | `translateY(0 → −38px) + opacity`, ease-in                               |
| Enter duration     | 50ms per char                                     | 440ms total                                                              |
| Exit duration      | 40ms per char                                     | 190ms total                                                              |
| Hold between words | ~400ms + char stagger time                        | ~600ms                                                                   |
| Word list          | `morph, learn, create, discover, research, morph` | `morph, explore, create, discover, research, morph`                      |
| Font size          | 2.5rem (desktop), 2rem (mobile)                   | Unchanged                                                                |
| Final word         | "morph" — settles permanently                     | "morph" — settles with one-time opacity pulse (400ms, 100→85→100%)       |

---

## Animation Spec

### Enter — `morphSlotIn`

```css
@keyframes morphSlotIn {
  0% {
    opacity: 0;
    transform: translateY(52px);
  }
  70% {
    opacity: 1;
    transform: translateY(-1.5px);
  }
  86% {
    transform: translateY(0.5px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
```

- Duration: `440ms`
- Easing: `linear` (the keyframe percentages control the curve internally)

### Exit — `morphSlotOut`

```css
@keyframes morphSlotOut {
  from {
    opacity: 1;
    transform: none;
  }
  to {
    opacity: 0;
    transform: translateY(-38px);
  }
}
```

- Duration: `190ms`
- Easing: `cubic-bezier(0.4, 0, 1, 1)` (ease-in — snappy exit)

### Final settle pulse — `morphSlotSettle`

```css
@keyframes morphSlotSettle {
  0% {
    opacity: 1;
  }
  40% {
    opacity: 0.85;
  }
  100% {
    opacity: 1;
  }
}
```

- Duration: `400ms`
- Easing: `ease-in-out`
- Fires once after the final "morph" enters. Applied to the slot unit element, not looped.

---

## Component Changes

### `PolySuffixFluid` — animation model

The current component renders individual `<span>` elements per character and applies staggered animations to each. This must be replaced with a single text node animated as a unit.

**New render model:**

- The suffix `<span>` wraps a single text-content string (no per-character spans)
- `overflow: hidden` on the wrapper clips the vertical travel during the slot animation
- On word change: apply exit animation → swap text → apply enter animation. In React, use the existing `wordKey` increment (already causes remount, resetting CSS animation state) for enter; use `isExiting` state to apply exit animation imperatively via `style` prop before the swap
- On final word: apply enter animation, then fire the settle pulse via `setTimeout(enterDuration)` inside a `useEffect` that watches `settled`

**Preserved layout hacks (do not remove):**

- `marginRight: -${SUFFIX_MAX_LEN - FINAL_WORD.length}ch` on the outer inline-flex span — prevents the static `poly` prefix from shifting right when short words are displayed against the reserved `minWidth`
- `minWidth: ${SUFFIX_MAX_LEN}ch` on the suffix wrapper — reserves full width at all times to prevent layout shift

**State that remains:**

- `word`, `wordKey`, `isExiting`, `wordIndex`, `settled` — same shape
- `usePrefersReducedMotion` — still respected (skip to final word immediately)

**Timing constants to update:**

```ts
const enterDuration = 440
const exitDuration = 190
const holdDelay = wordIndex === -1 ? 100 : enterDuration + 600
```

No stagger calculation needed — remove all stagger-related code.

### `SUFFIX_WORDS`

```ts
const SUFFIX_WORDS = [
  'morph',
  'explore',
  'create',
  'discover',
  'research',
  'morph'
] as const
```

### CSS keyframes (`app/globals.css`)

Replace `morphFluidEnter` / `morphFluidExit` with `morphSlotIn` / `morphSlotOut` / `morphSlotSettle`.

---

## What Does Not Change

- `PolymorphWordmark` wrapper component — no changes
- Font size: `text-[2.5rem]` desktop, `text-[2rem]` mobile — no changes
- `min-width` reservation using `SUFFIX_MAX_LEN` — keep to prevent layout shift
- `usePrefersReducedMotion` — keep, still skips to final word
- Usage in `chat-panel.tsx` — no changes

---

## Files Touched

1. `components/polymorph-wordmark.tsx` — animation model rewrite
2. `app/globals.css` — replace keyframes

---

## Out of Scope

- Typeface, weight, color changes
- Layout or positioning changes
- Mobile-specific animation differences
- Any other component
