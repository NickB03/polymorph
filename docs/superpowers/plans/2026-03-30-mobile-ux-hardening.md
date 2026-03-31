# Mobile UX Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical and high-priority mobile UX issues identified in the mobile audit — viewport accessibility, touch targets, safe areas, hydration, iOS input zoom, and component responsiveness.

**Architecture:** Changes are scoped to base UI components (`components/ui/`), global CSS (`app/globals.css`), layout config (`app/layout.tsx`), fixed/sticky bottom elements, and the mobile detection hook (`hooks/use-mobile.tsx`). Base component fixes cascade to every consumer automatically. No new dependencies.

**Audit (2026-03-30):** Plan reviewed by 6-agent audit team (code accuracy, architecture, accessibility, completeness, + 2 meta-auditors). All 9 original tasks verified code-accurate. Audit added: iOS input zoom fix (CRITICAL), `@utility scrollbar-none` definition (was silently missing), safe area for fixed/sticky bottom elements, Select component parity, DropdownMenu viewport constraint, voice-orb dual-query migration strategy. Original Task 9 → Task 10.

**Audit 2 (2026-03-30):** Second-pass review by 5-agent team (code-accuracy, architecture, accessibility, completeness, consensus coordinator). All 10 tasks re-verified against current codebase — every file path, line number, and class string confirmed accurate. Three amendments added:

1. **MUST FIX — Test mock update (Task 3):** `components/chat.test.tsx:180` mocks `@/lib/hooks/use-media-query`. After deleting that file, update the mock to `@/hooks/use-mobile` with `useIsMobile: () => false`. Without this, tests break.
2. **SHOULD FIX — Additional min-w-80 components (Task 6):** Plan covers 4 of 9 tool-ui components with `min-w-80`. Five more need the same fix: `data-table.tsx:208`, `timeline.tsx:122`, `chart.tsx:167`, `callout.tsx:88`, `plan.tsx:352`. Add these to Task 6 for completeness.
3. **CONSIDER — Safe area specificity (Task 9):** `pb-safe` alongside `pb-4` relies on CSS source order for the winning `padding-bottom`. Consider using `pb-[max(1rem,env(safe-area-inset-bottom,0px))]` on chat-panel instead, to guarantee the larger value wins regardless of compilation order. Drawer and sheet (which only have `pb-safe` without competing `pb-*`) are fine as-is.

**Tech Stack:** Tailwind CSS v4, React 19, Next.js 16 App Router, Radix UI primitives

---

## File Structure

| Action | File                                                       | Responsibility                                                            |
| ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| Modify | `app/layout.tsx`                                           | Viewport meta: allow zoom, add `viewportFit`                              |
| Modify | `app/globals.css`                                          | Safe area CSS utilities, scrollbar-none utility, touch-target base styles |
| Modify | `hooks/use-mobile.tsx`                                     | SSR-safe hydration, export breakpoint constant                            |
| Delete | `lib/hooks/use-media-query.ts`                             | Remove duplicate hook — consumers migrate to `useIsMobile()`              |
| Modify | `components/chat-messages.tsx`                             | Replace `useMediaQuery` with `useIsMobile`                                |
| Modify | `components/activity/activity-drawer.tsx`                  | Replace `useMediaQuery` with `useIsMobile`                                |
| Modify | `components/ui/button.tsx`                                 | Mobile-friendly touch targets                                             |
| Modify | `components/ui/input.tsx`                                  | Mobile-friendly height, iOS zoom fix                                      |
| Modify | `components/ui/textarea.tsx`                               | iOS zoom fix, responsive min-height                                       |
| Modify | `components/ui/select.tsx`                                 | Touch-target sizing, viewport constraint                                  |
| Modify | `components/ui/dropdown-menu.tsx`                          | Mobile touch-target padding, viewport constraint                          |
| Modify | `components/ui/dialog.tsx`                                 | Responsive padding, border radius                                         |
| Modify | `components/ui/alert-dialog.tsx`                           | Responsive padding, border radius                                         |
| Modify | `components/ui/popover.tsx`                                | Max-width viewport constraint                                             |
| Modify | `components/ui/card.tsx`                                   | Responsive padding                                                        |
| Modify | `components/tool-ui/progress-tracker/progress-tracker.tsx` | Remove rigid min-width                                                    |
| Modify | `components/tool-ui/option-list/option-list.tsx`           | Remove rigid min-width                                                    |
| Modify | `components/tool-ui/question-wizard/question-wizard.tsx`   | Remove rigid min-width                                                    |
| Modify | `components/tool-ui/link-preview/link-preview.tsx`         | Remove rigid min-width                                                    |
| Modify | `components/canvas/canvas-editor.tsx`                      | Scrollable file tabs, click-based add-file menu                           |
| Modify | `components/uploaded-file-list.tsx`                        | Responsive gap                                                            |
| Modify | `components/search-mode-selector.tsx`                      | Responsive dropdown width                                                 |
| Modify | `components/sidebar/chat-menu-item.tsx`                    | Touch-target sizing                                                       |
| Modify | `components/ui/drawer.tsx`                                 | Safe area bottom padding                                                  |
| Modify | `components/ui/sheet.tsx`                                  | Safe area bottom padding (bottom variant)                                 |
| Modify | `components/chat-panel.tsx`                                | Safe area bottom padding                                                  |
| Modify | `components/voice/voice-orb.tsx`                           | Inline media queries (Task 3), safe area bottom offset (Task 9)           |

---

### Task 1: Fix Viewport — Allow Zoom and Add Safe Area Support

**Files:**

- Modify: `app/layout.tsx:27-32`
- Modify: `app/globals.css` (append after line 634)

- [ ] **Step 1: Update viewport config in layout.tsx**

In `app/layout.tsx`, replace the viewport export (lines 27-32):

```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1
}
```

With:

```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}
```

This removes `maximumScale: 1` (which violated WCAG 2.1 by disabling pinch-zoom) and adds `viewportFit: 'cover'` so `env(safe-area-inset-*)` values become available for notch/Dynamic Island devices.

- [ ] **Step 2: Add safe area CSS utilities to globals.css**

Append to `app/globals.css` after the closing `}` of the `@layer base` block (after line 634):

```css
/* Safe area utilities for notch/Dynamic Island devices */
@utility pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
@utility pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
@utility pl-safe {
  padding-left: env(safe-area-inset-left, 0px);
}
@utility pr-safe {
  padding-right: env(safe-area-inset-right, 0px);
}

/* Scrollbar hiding for horizontal scroll containers */
@utility scrollbar-none {
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
```

- [ ] **Step 3: Apply safe area to body in layout.tsx**

In `app/layout.tsx`, add safe area padding to the `<body>` tag (line 54):

Replace:

```tsx
'min-h-screen flex flex-col font-sans antialiased overflow-hidden',
```

With:

```tsx
'min-h-screen flex flex-col font-sans antialiased overflow-hidden pb-safe',
```

- [ ] **Step 4: Run lint and typecheck**

```bash
bun lint && bun typecheck
```

Expected: PASS with no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "fix(mobile): allow pinch-zoom and add safe area support

Remove maximumScale:1 (WCAG 2.1 violation), add viewportFit:cover
for notch devices, and create safe area CSS utilities."
```

---

### Task 2: Fix Mobile Detection Hook — SSR-Safe Hydration

**Files:**

- Modify: `hooks/use-mobile.tsx`

- [ ] **Step 1: Rewrite use-mobile.tsx for SSR safety**

Replace the entire contents of `hooks/use-mobile.tsx`:

```tsx
import * as React from 'react'

export const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(mql.matches)
    }
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
```

Key changes:

- Default state is `false` (not `undefined`) — matches server render (desktop-first)
- Uses `mql.matches` instead of `window.innerWidth` — consistent with the media query listener
- Exports `MOBILE_BREAKPOINT` for reuse
- Return type is `boolean` (no `!!` coercion needed)

- [ ] **Step 2: Run typecheck**

```bash
bun typecheck
```

Expected: PASS. The return type change from `boolean` (via `!!undefined`) to `boolean` is compatible.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-mobile.tsx
git commit -m "fix(mobile): make useIsMobile SSR-safe with consistent default

Default to false instead of undefined to prevent hydration mismatch.
Export MOBILE_BREAKPOINT constant for reuse."
```

---

### Task 3: Unify Mobile Detection — Remove Duplicate Hook

**Files:**

- Delete: `lib/hooks/use-media-query.ts`
- Modify: `components/chat-messages.tsx:78`
- Modify: `components/activity/activity-drawer.tsx:14`

- [ ] **Step 1: Update chat-messages.tsx to use useIsMobile**

In `components/chat-messages.tsx`, replace the import and usage:

Find (around line 78):

```tsx
import { useMediaQuery } from '@/lib/hooks/use-media-query'
```

```tsx
const isMobile = useMediaQuery('(max-width: 767px)')
```

Replace import with:

```tsx
import { useIsMobile } from '@/hooks/use-mobile'
```

Replace usage with:

```tsx
const isMobile = useIsMobile()
```

Note: The old query used 767px; `useIsMobile` uses `max-width: 767px` (MOBILE_BREAKPOINT - 1 = 767). Behavior is identical.

- [ ] **Step 2: Update activity-drawer.tsx to use useIsMobile**

In `components/activity/activity-drawer.tsx`, replace the import and usage:

Find (around line 14):

```tsx
import { useMediaQuery } from '@/lib/hooks/use-media-query'
```

```tsx
const isMobile = useMediaQuery('(max-width: 767px)')
```

Replace import with:

```tsx
import { useIsMobile } from '@/hooks/use-mobile'
```

Replace usage with:

```tsx
const isMobile = useIsMobile()
```

- [ ] **Step 3: Check for any remaining consumers of use-media-query**

```bash
rg "use-media-query" --type ts --type tsx
```

The remaining consumer is `components/voice/voice-orb.tsx`, which uses **two** different `useMediaQuery` calls:

1. `useMediaQuery('(max-width: 639px)')` — a 640px breakpoint (intentionally different from the 768px mobile breakpoint, specific to voice UI layout)
2. `useMediaQuery('(prefers-reduced-motion: reduce)')` — a system accessibility preference, not a responsive breakpoint

These two queries serve different purposes and should be handled separately.

- [ ] **Step 4: Inline media queries in voice-orb.tsx**

In `components/voice/voice-orb.tsx`, replace the `useMediaQuery` import with inline `matchMedia` hooks:

Replace:

```tsx
import { useMediaQuery } from '@/lib/hooks/use-media-query'
```

With two local hooks at the top of the file (before the component):

```tsx
function useVoiceBreakpoint() {
  const [matches, setMatches] = React.useState(false)
  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)')
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return matches
}

function usePrefersReducedMotion() {
  const [matches, setMatches] = React.useState(false)
  React.useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return matches
}
```

Then update the usages in the component:

```tsx
const isMobileViewport = useVoiceBreakpoint()
const prefersReducedMotion = usePrefersReducedMotion()
```

This avoids keeping the shared `use-media-query.ts` file for a single consumer while preserving the intentional breakpoint differences.

- [ ] **Step 5: Delete lib/hooks/use-media-query.ts**

```bash
rm lib/hooks/use-media-query.ts
```

No consumers remain after the voice-orb migration.

- [ ] **Step 6: Run lint and typecheck**

```bash
bun lint && bun typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/chat-messages.tsx components/activity/activity-drawer.tsx components/voice/voice-orb.tsx lib/hooks/use-media-query.ts
git commit -m "refactor(mobile): unify mobile detection and remove shared useMediaQuery

Migrate chat-messages and activity-drawer to useIsMobile (768px).
Inline voice-orb's two queries (639px breakpoint + prefers-reduced-motion)
as local hooks. Delete shared use-media-query.ts — no consumers remain."
```

---

### Task 4: Fix Touch Targets — Base UI Components

**Files:**

- Modify: `components/ui/button.tsx:24-27`
- Modify: `components/ui/input.tsx:13`
- Modify: `components/ui/dropdown-menu.tsx:88,31,104,128`
- Modify: `components/sidebar/chat-menu-item.tsx:105`

- [ ] **Step 1: Update button size variants**

In `components/ui/button.tsx`, replace the `size` variants object (lines 23-28):

```tsx
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10'
      }
```

With:

```tsx
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-10 rounded-md px-3',
        lg: 'h-12 rounded-md px-8',
        icon: 'h-11 w-11'
      }
```

This bumps all variants up by 4px (1 Tailwind step) so the smallest interactive button is 40px (`sm` → `h-10`) and default/icon hit 44px (`h-11`).

- [ ] **Step 2: Update input height and fix iOS zoom**

In `components/ui/input.tsx`, replace line 13:

```tsx
'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
```

With:

```tsx
'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
```

Changes: `h-10` → `h-11` (40px → 44px), `text-sm` → `text-base md:text-sm` (16px on mobile prevents iOS Safari auto-zoom on focus, 14px on desktop preserves design).

- [ ] **Step 3: Fix textarea iOS zoom and responsive min-height**

In `components/ui/textarea.tsx`, replace line 12:

```tsx
'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
```

With:

```tsx
'flex min-h-[60px] sm:min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
```

Changes: `text-sm` → `text-base md:text-sm` (iOS zoom fix), `min-h-[80px]` → `min-h-[60px] sm:min-h-[80px]` (responsive min-height for small screens).

- [ ] **Step 4: Update dropdown menu item padding**

In `components/ui/dropdown-menu.tsx`, update the DropdownMenuItem class (line 88):

Replace:

```tsx
'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
```

With:

```tsx
'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-2.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
```

Change: `py-1.5` → `py-2.5` (6px → 10px vertical padding, bringing total item height to ~40px with text).

Apply the same `py-1.5` → `py-2.5` change to:

- `DropdownMenuSubTrigger` (line 31): `px-2 py-1.5` → `px-2 py-2.5`
- `DropdownMenuCheckboxItem` (line 104): `py-1.5 pl-8 pr-2` → `py-2.5 pl-8 pr-2`
- `DropdownMenuRadioItem` (line 128): `py-1.5 pl-8 pr-2` → `py-2.5 pl-8 pr-2`

- [ ] **Step 5: Update sidebar menu action icon sizing**

In `components/sidebar/chat-menu-item.tsx`, replace the className on line 105:

```tsx
className = 'size-6 p-1 mr-1 overflow-hidden'
```

With:

```tsx
className = 'size-8 p-1.5 mr-1 overflow-hidden'
```

Change: `size-6` → `size-8` (24px → 32px), `p-1` → `p-1.5`. Still compact but more tappable.

- [ ] **Step 6: Update Select trigger and item sizing**

In `components/ui/select.tsx`, update the SelectTrigger className (line 23):

Replace `h-10` with `h-11`:

```tsx
'flex h-11 w-full items-center justify-between...'
```

Change: `h-10` → `h-11` (40px → 44px) to match input/button.

Update SelectItem className (line 122) — replace `py-1.5` with `py-2.5`:

```tsx
'relative flex w-full cursor-default select-none items-center rounded-sm py-2.5 pl-1.5 pr-12...'
```

Update SelectLabel className (line 109) — same change: `py-1.5` → `py-2.5`.

Change: `py-1.5` → `py-2.5` to match dropdown menu item fix.

- [ ] **Step 7: Add viewport constraint to DropdownMenuContent**

In `components/ui/dropdown-menu.tsx`, update DropdownMenuContent (line 71):

Add `max-w-[calc(100vw-2rem)]` after `min-w-[8rem]`:

```tsx
'z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden...'
```

Apply the same `max-w-[calc(100vw-2rem)]` to DropdownMenuSubContent (line 52):

```tsx
'z-50 min-w-[8rem] max-w-[calc(100vw-2rem)] overflow-hidden...'
```

This matches the popover viewport constraint from Task 5, preventing dropdown overflow on narrow viewports.

- [ ] **Step 8: Run lint and typecheck**

```bash
bun lint && bun typecheck
```

Expected: PASS.

- [ ] **Step 9: Run existing component tests**

```bash
bun run test -- components/chat-panel.test.tsx components/canvas/canvas-workspace.test.tsx
```

Expected: PASS. The size changes shouldn't break behavioral tests.

- [ ] **Step 10: Commit**

```bash
git add components/ui/button.tsx components/ui/input.tsx components/ui/textarea.tsx components/ui/dropdown-menu.tsx components/ui/select.tsx components/sidebar/chat-menu-item.tsx
git commit -m "fix(mobile): increase touch targets and prevent iOS input zoom

Button default/icon: h-11 (44px), sm: h-10 (40px).
Input/textarea: h-11 (44px), text-base on mobile (prevents iOS zoom).
Select trigger: h-11. Select/dropdown items: py-2.5.
Dropdown menus: max-w viewport constraint.
Sidebar action: size-8 (32px)."
```

---

### Task 5: Fix Dialogs and Popovers — Mobile Responsiveness

**Files:**

- Modify: `components/ui/dialog.tsx:41`
- Modify: `components/ui/alert-dialog.tsx:41`
- Modify: `components/ui/popover.tsx:23`
- Modify: `components/ui/card.tsx:26,63,73`

- [ ] **Step 1: Update DialogContent for mobile**

In `components/ui/dialog.tsx`, replace the className on lines 40-41:

```tsx
'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-48 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-48 sm:rounded-lg',
```

With:

```tsx
'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-4 sm:p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-48 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-48 rounded-lg',
```

Changes: `p-6` → `p-4 sm:p-6`, `sm:rounded-lg` → `rounded-lg`.

- [ ] **Step 2: Update AlertDialogContent for mobile**

In `components/ui/alert-dialog.tsx`, replace the className on lines 40-41 with the same pattern:

```tsx
'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-4 sm:p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-48 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-48 rounded-lg',
```

Same changes: `p-6` → `p-4 sm:p-6`, `sm:rounded-lg` → `rounded-lg`.

- [ ] **Step 3: Update PopoverContent with viewport constraint**

In `components/ui/popover.tsx`, replace the className on line 23:

```tsx
'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]',
```

With:

```tsx
'z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]',
```

Change: Added `max-w-[calc(100vw-2rem)]` after `w-72`. Popover can never exceed viewport minus 1rem margin on each side.

- [ ] **Step 4: Update Card responsive padding**

In `components/ui/card.tsx`:

Replace line 26:

```tsx
className={cn('flex flex-col space-y-1.5 p-6', className)}
```

With:

```tsx
className={cn('flex flex-col space-y-1.5 p-4 sm:p-6', className)}
```

Replace line 63:

```tsx
<div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
```

With:

```tsx
<div
  ref={ref}
  className={cn('p-4 pt-0 sm:p-6 sm:pt-0', className)}
  {...props}
/>
```

Replace line 73:

```tsx
className={cn('flex items-center p-6 pt-0', className)}
```

With:

```tsx
className={cn('flex items-center p-4 pt-0 sm:p-6 sm:pt-0', className)}
```

- [ ] **Step 5: Run lint and typecheck**

```bash
bun lint && bun typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ui/dialog.tsx components/ui/alert-dialog.tsx components/ui/popover.tsx components/ui/card.tsx
git commit -m "fix(mobile): responsive padding on dialogs, popovers, and cards

Dialogs: p-4 sm:p-6, rounded-lg always (not just sm:).
Popovers: max-w-[calc(100vw-2rem)] prevents viewport overflow.
Cards: p-4 sm:p-6 preserves content area on small screens."
```

---

### Task 6: Fix Tool UI Min-Width Overflow

**Files:**

- Modify: `components/tool-ui/progress-tracker/progress-tracker.tsx:183,257`
- Modify: `components/tool-ui/option-list/option-list.tsx:173,567`
- Modify: `components/tool-ui/question-wizard/question-wizard.tsx:61,218`
- Modify: `components/tool-ui/link-preview/link-preview.tsx:59`

- [ ] **Step 1: Update progress-tracker.tsx**

In `components/tool-ui/progress-tracker/progress-tracker.tsx`:

Line 183 — replace `min-w-80` with nothing (remove it):

```
'isolate flex w-full max-w-md min-w-80 flex-col'
```

→

```
'isolate flex w-full max-w-md flex-col'
```

Line 257 — same change:

```
'isolate flex w-full max-w-md min-w-80 flex-col gap-3'
```

→

```
'isolate flex w-full max-w-md flex-col gap-3'
```

The `w-full max-w-md` pair already handles sizing correctly — `min-w-80` (320px) only causes overflow on narrow viewports. Remove it entirely.

- [ ] **Step 2: Update option-list.tsx**

In `components/tool-ui/option-list/option-list.tsx`:

Line 173:

```
'@container/option-list flex w-full max-w-md min-w-80 flex-col'
```

→

```
'@container/option-list flex w-full max-w-md flex-col'
```

Line 567:

```
'@container/option-list flex w-full max-w-md min-w-80 flex-col gap-3'
```

→

```
'@container/option-list flex w-full max-w-md flex-col gap-3'
```

- [ ] **Step 3: Update question-wizard.tsx**

In `components/tool-ui/question-wizard/question-wizard.tsx`:

Line 61:

```
'flex w-full max-w-md min-w-80 flex-col'
```

→

```
'flex w-full max-w-md flex-col'
```

Line 218:

```
'flex w-full max-w-md min-w-80 flex-col gap-3'
```

→

```
'flex w-full max-w-md flex-col gap-3'
```

- [ ] **Step 4: Update link-preview.tsx**

In `components/tool-ui/link-preview/link-preview.tsx`:

Line 59:

```
'relative w-full max-w-md min-w-80'
```

→

```
'relative w-full max-w-md'
```

- [ ] **Step 5: Run lint and typecheck**

```bash
bun lint && bun typecheck
```

Expected: PASS.

- [ ] **Step 6: Run existing tool-ui test**

```bash
bun run test -- components/tool-ui/registry.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/tool-ui/progress-tracker/progress-tracker.tsx components/tool-ui/option-list/option-list.tsx components/tool-ui/question-wizard/question-wizard.tsx components/tool-ui/link-preview/link-preview.tsx
git commit -m "fix(mobile): remove min-w-80 from tool-ui components

w-full max-w-md already handles sizing. The min-w-80 (320px)
forced horizontal scroll on narrow mobile viewports."
```

---

### Task 7: Fix Canvas Editor File Tabs and Add-File Menu

**Files:**

- Modify: `components/canvas/canvas-editor.tsx:265-306`

- [ ] **Step 1: Make file tabs horizontally scrollable**

In `components/canvas/canvas-editor.tsx`, replace the file tab container (lines 265-267):

```tsx
      <div
        className="flex items-center border-b px-2"
        data-testid="canvas-file-tabs"
      >
```

With:

```tsx
      <div
        className="flex items-center border-b px-2 overflow-x-auto scrollbar-none"
        data-testid="canvas-file-tabs"
      >
```

Change: Added `overflow-x-auto scrollbar-none`. Tabs scroll horizontally on mobile when they overflow, with the scrollbar hidden for cleaner appearance (the scroll behavior remains).

- [ ] **Step 2: Fix add-file dropdown from hover to click**

In `components/canvas/canvas-editor.tsx`, replace the add-file button group (lines 285-305):

```tsx
{
  addableFiles.length > 0 && (
    <div className="relative group">
      <button
        className="px-2 py-2 text-muted-foreground hover:text-foreground"
        data-testid="canvas-add-file"
        aria-label="Add file"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <div className="absolute left-0 top-full z-10 hidden min-w-[140px] rounded-md border bg-popover p-1 shadow-md group-hover:block">
        {addableFiles.map(file => (
          <button
            key={file}
            className="block w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-accent"
            onClick={() => handleAddFile(file)}
            data-testid={`canvas-add-file-${file}`}
          >
            {file}
          </button>
        ))}
      </div>
    </div>
  )
}
```

With:

```tsx
{
  addableFiles.length > 0 && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="px-2 py-2 text-muted-foreground hover:text-foreground shrink-0"
          data-testid="canvas-add-file"
          aria-label="Add file"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {addableFiles.map(file => (
          <DropdownMenuItem
            key={file}
            className="text-xs"
            onClick={() => handleAddFile(file)}
            data-testid={`canvas-add-file-${file}`}
          >
            {file}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

This replaces the `group-hover:block` CSS pattern (which doesn't work on touch devices) with a Radix DropdownMenu that works on both click and touch.

Ensure the necessary imports are present at the top of the file:

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
```

- [ ] **Step 3: Add shrink-0 to file tab buttons to prevent shrinking**

In `components/canvas/canvas-editor.tsx`, update each file tab button (line 272):

```tsx
'px-3 py-2 text-xs font-medium transition-colors',
```

With:

```tsx
'shrink-0 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap',
```

Prevents tab labels from shrinking/wrapping in the scroll container.

- [ ] **Step 4: Run existing canvas tests**

```bash
bun run test -- components/canvas/canvas-workspace.test.tsx components/canvas/canvas-editor.test.tsx components/canvas/canvas-preview.test.tsx
```

Expected: PASS (canvas-editor.test.tsx may not exist — that's fine, run what exists).

- [ ] **Step 5: Run lint and typecheck**

```bash
bun lint && bun typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/canvas/canvas-editor.tsx
git commit -m "fix(mobile): scrollable file tabs and click-based add-file menu

File tabs now scroll horizontally on narrow screens.
Add-file dropdown replaced from hover-only to Radix DropdownMenu
that works on both mouse and touch."
```

---

### Task 8: Fix Remaining Component Mobile Issues

**Files:**

- Modify: `components/uploaded-file-list.tsx:21`
- Modify: `components/search-mode-selector.tsx:91`

- [ ] **Step 1: Fix uploaded file list gap**

In `components/uploaded-file-list.tsx`, replace line 21:

```tsx
<div className="flex gap-6 overflow-x-auto">
```

With:

```tsx
<div className="flex gap-3 sm:gap-6 overflow-x-auto scrollbar-none">
```

Changes: `gap-6` → `gap-3 sm:gap-6` (tighter on mobile), added `scrollbar-none` for cleaner scroll.

- [ ] **Step 2: Fix search mode dropdown width**

In `components/search-mode-selector.tsx`, replace line 91:

```tsx
<DropdownMenuContent align="start" className="w-64" sideOffset={5}>
```

With:

```tsx
<DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)]" sideOffset={5}>
```

Same viewport-constraint pattern as the popover fix.

- [ ] **Step 3: Run lint and typecheck**

```bash
bun lint && bun typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/uploaded-file-list.tsx components/search-mode-selector.tsx
git commit -m "fix(mobile): responsive file list gap and dropdown constraint

File list: gap-3 on mobile, gap-6 on desktop.
Search mode dropdown: viewport-constrained max-width."
```

---

### Task 9: Apply Safe Area to Fixed/Sticky Bottom Elements

Body-level `pb-safe` (Task 1) does NOT cascade to `position: fixed` or `position: sticky` children — those elements are positioned relative to the viewport, not the document flow. Each bottom-anchored element needs its own safe area handling.

**Files:**

- Modify: `components/ui/drawer.tsx:47`
- Modify: `components/ui/sheet.tsx:34-45`
- Modify: `components/chat-panel.tsx:156`
- Modify: `components/voice/voice-orb.tsx:81`

- [ ] **Step 1: Add safe area to DrawerContent**

In `components/ui/drawer.tsx`, update the DrawerContent className (line 47). Add `pb-safe` to the class string:

```tsx
'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background pb-safe',
```

This ensures drawer content clears the home indicator on notch/Dynamic Island devices.

- [ ] **Step 2: Add safe area to Sheet bottom variant**

In `components/ui/sheet.tsx`, update the `bottom` variant in `sheetVariants` to include `pb-safe`:

```tsx
bottom: 'inset-x-0 bottom-0 border-t pb-safe',
```

Only the `bottom` variant needs safe area — `top`, `left`, and `right` variants don't anchor to the bottom edge.

- [ ] **Step 3: Add safe area to ChatPanel**

In `components/chat-panel.tsx`, update the sticky container className (line 156):

Replace:

```tsx
'sticky bottom-0 px-2 pb-4'
```

With:

```tsx
'sticky bottom-0 px-2 pb-4 pb-safe'
```

Note: `pb-safe` uses `env(safe-area-inset-bottom, 0px)` — on non-notch devices this resolves to 0px so `pb-4` takes effect. On notch devices the safe area inset (typically 34px) overrides the 16px `pb-4`.

- [ ] **Step 4: Add safe area offset to VoiceOrb**

In `components/voice/voice-orb.tsx`, update the fixed positioning className (line 81):

Replace:

```tsx
className =
  'fixed bottom-24 right-6 z-40 flex flex-col items-center gap-2 max-md:inset-x-4 max-md:right-auto max-md:bottom-32'
```

With:

```tsx
className =
  'fixed bottom-24 right-6 z-40 flex flex-col items-center gap-2 max-md:inset-x-4 max-md:right-auto max-md:bottom-32 max-md:pb-safe'
```

On mobile, the voice orb gets safe area bottom padding so it clears the home indicator.

- [ ] **Step 5: Run lint and typecheck**

```bash
bun lint && bun typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ui/drawer.tsx components/ui/sheet.tsx components/chat-panel.tsx components/voice/voice-orb.tsx
git commit -m "fix(mobile): add safe area padding to fixed/sticky bottom elements

Body pb-safe doesn't cascade to fixed/sticky children.
Drawer, sheet (bottom), chat panel, and voice orb each need
their own env(safe-area-inset-bottom) handling."
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run full lint**

```bash
bun lint
```

Expected: PASS with zero warnings.

- [ ] **Step 2: Run full typecheck**

```bash
bun typecheck
```

Expected: PASS with zero errors.

- [ ] **Step 3: Run full test suite**

```bash
bun run test
```

Expected: All tests PASS.

- [ ] **Step 4: Run dev server and verify**

```bash
bun dev
```

Open Chrome DevTools → toggle device toolbar → test at 375px (iPhone SE), 390px (iPhone 14), and 768px (iPad) widths. Verify:

- Pinch-zoom works
- Dialogs have rounded corners and appropriate padding on mobile
- Dropdown and select menus don't overflow viewport
- Tool UI components don't force horizontal scroll
- Canvas file tabs scroll horizontally
- Add-file menu opens on click/tap
- Input fields and buttons are comfortably tappable
- Inputs and textareas don't trigger iOS zoom on focus (text-base on mobile)
- Drawer, sheet, chat panel clear the home indicator area on notch devices
- Voice orb doesn't overlap the home indicator on mobile
