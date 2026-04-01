# UI Audit Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 39 issues identified in the UI audit across accessibility, theming, performance, and responsive design.

**Architecture:** All changes are isolated per-component. No shared state, API, or schema changes. Each task modifies 1-4 files and can be committed independently. Tasks are ordered by severity (critical first) and grouped by fix type so related changes ship together.

**Tech Stack:** React 19, Tailwind CSS v4 (OKLCH tokens via `@theme`), Radix UI primitives, Next.js Image, Vitest

---

## File Map

| Task | Files                                                                                                                                                                   | Responsibility                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1    | `components/search-results-image.tsx`, `components/video-carousel-dialog.tsx`                                                                                           | Keyboard a11y + focus indicators on carousels |
| 2    | `components/ui/icons.tsx`                                                                                                                                               | Theme-adaptive SVG fills                      |
| 3    | `components/ui/password-input.tsx`, `components/login-form.tsx`, `components/sign-up-form.tsx`, `components/forgot-password-form.tsx`                                   | Form ARIA attributes                          |
| 4    | `components/ui/dialog.tsx`, `components/ui/alert-dialog.tsx`, `components/ui/sheet.tsx`, `components/ui/drawer.tsx`                                                     | Overlay color tokens                          |
| 5    | `components/voice/voice-orb.tsx`, `components/voice/voice-settings.tsx`                                                                                                 | Voice component token compliance              |
| 6    | `components/uploaded-file-list.tsx`, `components/video-result-grid.tsx`, `components/tool-ui/plan/plan.tsx`, `components/tool-ui/progress-tracker/progress-tracker.tsx` | Remaining hard-coded color fixes              |
| 7    | `components/search-results-image.tsx`, `components/tool-ui/link-preview/link-preview.tsx`                                                                               | Image CLS fixes                               |
| 8    | `components/research-process-section.tsx`, `components/ui/bar-visualizer.tsx`                                                                                           | Memoization + animation perf                  |
| 9    | `components/sidebar/chat-history-client.tsx`                                                                                                                            | Duplicate fetch elimination                   |
| 10   | `components/action-buttons.tsx`, `components/voice/voice-orb.tsx`, `components/ui/textarea.tsx`                                                                         | Responsive design fixes                       |
| 11   | `components/section.tsx`, `components/related-questions.tsx`, `components/search-results-image.tsx`                                                                     | Minor a11y (aria-hidden, alt text)            |

---

### Task 1: Critical Keyboard Accessibility + Focus Indicators

**Fixes:** C1 (clickable div without keyboard), C2 (focus indicators removed)

**Files:**

- Modify: `components/search-results-image.tsx:299-302,347,350`
- Modify: `components/video-carousel-dialog.tsx:108,111`

- [ ] **Step 1: Fix clickable div in search-results-image.tsx**

The `<div>` at line 299 is wrapped in `<DialogTrigger asChild>`, which means Radix will forward keyboard handling to the child. However, the `<div>` is not a valid interactive element. Replace the `<div>` with a `<button>` so Radix can properly delegate focus and keyboard events.

In `components/search-results-image.tsx`, find the clickable div around line 299:

```tsx
<div
  className="aspect-video cursor-pointer relative"
  onClick={() => handleSelect(actualIndex)}
>
```

Replace with:

```tsx
<button
  type="button"
  className="aspect-video cursor-pointer relative w-full text-left"
  onClick={() => handleSelect(actualIndex)}
>
```

Also update the corresponding closing tag from `</div>` to `</button>`.

- [ ] **Step 2: Restore focus indicators on carousel buttons in search-results-image.tsx**

At lines 347 and 350, the CarouselPrevious and CarouselNext buttons suppress focus rings. Add `focus-visible:ring-2 focus-visible:ring-ring` to restore keyboard visibility.

Find:

```tsx
<CarouselPrevious className="w-10 h-10 rounded-full shadow-sm focus:outline-hidden">
```

Replace with:

```tsx
<CarouselPrevious className="w-10 h-10 rounded-full shadow-sm focus-visible:ring-2 focus-visible:ring-ring">
```

Find:

```tsx
<CarouselNext className="w-10 h-10 rounded-full shadow-sm focus:outline-hidden">
```

Replace with:

```tsx
<CarouselNext className="w-10 h-10 rounded-full shadow-sm focus-visible:ring-2 focus-visible:ring-ring">
```

- [ ] **Step 3: Restore focus indicators on carousel buttons in video-carousel-dialog.tsx**

Same fix at lines 108 and 111. Find each instance of `focus:outline-hidden` on CarouselPrevious and CarouselNext and replace with `focus-visible:ring-2 focus-visible:ring-ring`.

- [ ] **Step 4: Verify and commit**

Run: `bun typecheck && bun lint`
Expected: No errors related to changed files.

```bash
git add components/search-results-image.tsx components/video-carousel-dialog.tsx
git commit -m "fix(a11y): restore keyboard support and focus indicators on image/video carousels"
```

---

### Task 2: Theme-Adaptive SVG Icons

**Fixes:** C3 (hard-coded fill="black"/"white"/"#222" in SVGs)

**Files:**

- Modify: `components/ui/icons.tsx:17-19,160,166,174`

- [ ] **Step 1: Update IconLogo fills**

`IconLogo` uses `fill="black"` for the outer circle and `fill="white"` for the two eye circles. Replace with `currentColor` and a contrasting approach. Since this is a two-tone logo (dark body, light eyes), use `currentColor` for the body and a CSS variable for the eyes.

Find at line 17:

```tsx
<circle cx="128" cy="128" r="128" fill="black" />
```

Replace with:

```tsx
<circle cx="128" cy="128" r="128" fill="currentColor" />
```

Find at lines 18-19 (the two eye circles with `fill="white"`):

```tsx
fill = 'white'
```

Replace both instances with:

```tsx
fill = 'var(--background)'
```

This uses the background CSS token so the eyes are always the inverse of the body color — they appear white on dark backgrounds and adapt properly in dark mode.

- [ ] **Step 2: Update IconBlinkingLogo fills**

Same approach for the blinking logo variant. Find at line 160:

```tsx
<circle cx="128" cy="128" r="128" fill="#222" />
```

Replace with:

```tsx
<circle cx="128" cy="128" r="128" fill="currentColor" />
```

Find the two eye ellipses at lines 166 and 174 with `fill="white"`, replace both with:

```tsx
fill = 'var(--background)'
```

- [ ] **Step 3: Verify and commit**

Run: `bun typecheck && bun lint`
Expected: No errors.

Visually verify the logo renders correctly in both light and dark mode — the body should inherit the parent's text color, eyes should match the page background.

```bash
git add components/ui/icons.tsx
git commit -m "fix(theme): use currentColor and CSS tokens for SVG icon fills"
```

---

### Task 3: Form Accessibility (ARIA Attributes)

**Fixes:** H3 (form error ARIA), H4 (password toggle label)

**Files:**

- Modify: `components/ui/password-input.tsx:21-33`
- Modify: `components/login-form.tsx:120-157`
- Modify: `components/sign-up-form.tsx` (same pattern)
- Modify: `components/forgot-password-form.tsx` (same pattern)

- [ ] **Step 1: Add aria-label to password visibility toggle**

In `components/ui/password-input.tsx`, the toggle `<Button>` around line 21 has no `aria-label`. Add one that reflects current state.

Find the `<Button>` inside the password input:

```tsx
<Button
  type="button"
  variant="ghost"
  size="icon"
  className="h-full px-3 py-2 hover:bg-transparent absolute right-0 flex items-center justify-center"
  onClick={() => setShowPassword(!showPassword)}
>
```

Replace with:

```tsx
<Button
  type="button"
  variant="ghost"
  size="icon"
  className="h-full px-3 py-2 hover:bg-transparent absolute right-0 flex items-center justify-center"
  onClick={() => setShowPassword(!showPassword)}
  aria-label={showPassword ? 'Hide password' : 'Show password'}
  aria-pressed={showPassword}
>
```

- [ ] **Step 2: Add error announcement to login form**

In `components/login-form.tsx`, the error `<p>` tag around line 153 needs `role="alert"` so screen readers announce it dynamically.

Find the error display (pattern will look like):

```tsx
<p className="text-sm text-destructive">
```

Replace with:

```tsx
<p className="text-sm text-destructive" role="alert">
```

Also add `aria-describedby` to the email and password inputs so they reference the error when present. This links the error message to the input field for screen readers.

For the form's error container, add an `id`:

```tsx
<p className="text-sm text-destructive" role="alert" id="login-error">
```

Then on both the email and password `<Input>` elements, add:

```tsx
aria-describedby={error ? 'login-error' : undefined}
```

- [ ] **Step 3: Apply same pattern to sign-up-form.tsx and forgot-password-form.tsx**

Apply the same `role="alert"` + `id` + `aria-describedby` pattern to both files. Use `id="signup-error"` and `id="forgot-password-error"` respectively.

- [ ] **Step 4: Verify and commit**

Run: `bun typecheck && bun lint`
Expected: No errors.

```bash
git add components/ui/password-input.tsx components/login-form.tsx components/sign-up-form.tsx components/forgot-password-form.tsx
git commit -m "fix(a11y): add ARIA attributes to auth forms and password toggle"
```

---

### Task 4: Overlay Color Tokens

**Fixes:** H5 (hard-coded bg-black on overlays)

**Files:**

- Modify: `components/ui/dialog.tsx:25`
- Modify: `components/ui/alert-dialog.tsx:23`
- Modify: `components/ui/sheet.tsx:25`
- Modify: `components/ui/drawer.tsx:32`

- [ ] **Step 1: Define overlay token in globals.css**

Add an `--overlay` CSS custom property to both light and dark themes in `app/globals.css`. This gives overlays a single semantic token.

In the `:root` (light mode) section, add:

```css
--overlay: oklch(0 0 0 / 0.8);
```

In the `.dark` section, add:

```css
--overlay: oklch(0 0 0 / 0.8);
```

Both start identical (black at 80% is conventional for overlays in both themes) but are now independently tunable. Also add the token to the `@theme` block:

```css
--color-overlay: var(--overlay);
```

- [ ] **Step 2: Update dialog.tsx overlay**

Find at line 25:

```tsx
className={cn('fixed inset-0 z-50 bg-black/80', className)}
```

Replace with:

```tsx
className={cn('fixed inset-0 z-50 bg-overlay', className)}
```

- [ ] **Step 3: Update alert-dialog.tsx overlay**

Find at line 23:

```tsx
className={cn('fixed inset-0 z-50 bg-black/80', className)}
```

Replace with:

```tsx
className={cn('fixed inset-0 z-50 bg-overlay', className)}
```

- [ ] **Step 4: Update sheet.tsx overlay**

Find at line 25. Note: the sheet uses 30% opacity, which is intentionally lighter. Create a separate token or use opacity override.

```tsx
className={cn('fixed inset-0 z-50 bg-black/30', className)}
```

Replace with:

```tsx
className={cn('fixed inset-0 z-50 bg-overlay/30', className)}
```

Wait — this won't work because `bg-overlay` already includes the alpha channel from the token. Instead, for sheet's lighter overlay, keep it as a fraction of the standard:

Add a second token in globals.css:

```css
--overlay-light: oklch(0 0 0 / 0.3);
```

And in the `@theme` block:

```css
--color-overlay-light: var(--overlay-light);
```

Then replace the sheet overlay:

```tsx
className={cn('fixed inset-0 z-50 bg-overlay-light', className)}
```

- [ ] **Step 5: Update drawer.tsx overlay**

Find at line 32:

```tsx
className={cn('fixed inset-0 z-50 bg-black/80', className)}
```

Replace with:

```tsx
className={cn('fixed inset-0 z-50 bg-overlay', className)}
```

- [ ] **Step 6: Verify and commit**

Run: `bun typecheck && bun lint`
Expected: No errors. Visually verify dialogs, sheets, and drawers still show proper overlay dimming in both themes.

```bash
git add app/globals.css components/ui/dialog.tsx components/ui/alert-dialog.tsx components/ui/sheet.tsx components/ui/drawer.tsx
git commit -m "fix(theme): replace hard-coded overlay colors with semantic tokens"
```

---

### Task 5: Voice Component Token Compliance

**Fixes:** H1 (voice subset), M16, M17

**Files:**

- Modify: `components/voice/voice-orb.tsx:124,132-134,152,159`
- Modify: `components/voice/voice-settings.tsx:145`

- [ ] **Step 1: Replace hard-coded colors in voice-orb.tsx**

The voice orb is intentionally dark — it's a "dark room" UI. Instead of raw `bg-black` and `text-white`, use the semantic tokens that naturally invert: `bg-foreground` (dark in light mode, light in dark mode) and `text-background` (light in light mode, dark in dark mode). This preserves the dark aesthetic while being token-compliant.

Find at line 124:

```tsx
bg - black / 90
```

Replace with:

```tsx
bg - foreground / 90
```

Find at line 133 (listening state):

```tsx
bg - white / 60
```

Replace with:

```tsx
bg - background / 60
```

Find at line 134 (waiting state):

```tsx
bg - white / 30
```

Replace with:

```tsx
bg - background / 30
```

Find at line 152 (state label):

```tsx
text - white / 50
```

Replace with:

```tsx
text - background / 50
```

Find at line 159 (stop button):

```tsx
text-white/50 hover:bg-white/10 hover:text-white
```

Replace with:

```tsx
text-background/50 hover:bg-background/10 hover:text-background
```

- [ ] **Step 2: Replace hard-coded toggle knob color in voice-settings.tsx**

Find at line 145:

```tsx
bg - white
```

Replace with:

```tsx
bg - background
```

- [ ] **Step 3: Verify and commit**

Run: `bun typecheck && bun lint`
Expected: No errors. Visually verify voice orb still appears dark in light mode and adjusts appropriately in dark mode.

```bash
git add components/voice/voice-orb.tsx components/voice/voice-settings.tsx
git commit -m "fix(theme): replace hard-coded colors in voice components with semantic tokens"
```

---

### Task 6: Remaining Hard-Coded Color Fixes

**Fixes:** H1 (remaining files)

**Files:**

- Modify: `components/uploaded-file-list.tsx:44-45,52`
- Modify: `components/video-result-grid.tsx:97`
- Modify: `components/tool-ui/plan/plan.tsx:68`
- Modify: `components/tool-ui/progress-tracker/progress-tracker.tsx:133,139`

- [ ] **Step 1: Fix uploaded-file-list.tsx**

Find at lines 44-45 (uploading overlay + spinner):

```tsx
bg - black / 40
```

Replace with:

```tsx
bg - foreground / 40
```

```tsx
text - white
```

Replace with:

```tsx
text - background
```

Find at line 52 (remove button):

```tsx
bg-black/40 hover:bg-destructive text-white
```

Replace with:

```tsx
bg-foreground/40 hover:bg-destructive text-background hover:text-destructive-foreground
```

Note: the `hover:text-destructive-foreground` ensures the text color is correct when hovering into the destructive state.

- [ ] **Step 2: Fix video-result-grid.tsx**

Find at line 97:

```tsx
bg-black/30 rounded-md flex items-center justify-center text-white/80
```

Replace with:

```tsx
bg-foreground/30 rounded-md flex items-center justify-center text-background/80
```

- [ ] **Step 3: Fix plan.tsx**

Find at line 68 (cancelled status badge X icon):

```tsx
text - white
```

The completed badge at line 54 uses `text-primary-foreground`. The cancelled badge sits on `bg-destructive`, so the correct token is `text-destructive-foreground`:

Replace with:

```tsx
text - destructive - foreground
```

- [ ] **Step 4: Fix progress-tracker.tsx**

Find at lines 133 and 139 (failed step indicators):

```tsx
text - white
```

Same pattern — these sit on `bg-destructive` containers:

Replace both with:

```tsx
text - destructive - foreground
```

- [ ] **Step 5: Verify and commit**

Run: `bun typecheck && bun lint`
Expected: No errors.

```bash
git add components/uploaded-file-list.tsx components/video-result-grid.tsx components/tool-ui/plan/plan.tsx components/tool-ui/progress-tracker/progress-tracker.tsx
git commit -m "fix(theme): replace remaining hard-coded colors with semantic tokens"
```

---

### Task 7: Image CLS Fixes

**Fixes:** H2 (external images missing width/height)

**Files:**

- Modify: `components/search-results-image.tsx:305-310,335-340`
- Modify: `components/tool-ui/link-preview/link-preview.tsx:93-103`

- [ ] **Step 1: Add aspect-ratio containment to search result images**

The search result images are external URLs with unknown dimensions, so we can't add literal `width`/`height`. Instead, wrap them in an aspect-ratio container that reserves space before the image loads, preventing CLS.

In `components/search-results-image.tsx`, the grid images (around line 305) are already inside an `aspect-video` parent, which is correct — the parent reserves the 16:9 space. Verify the `<img>` tag itself uses `object-cover` to fill the container without CLS:

```tsx
<img
  src={image.url}
  alt={`${query} result ${actualIndex + 1}`}
  loading="lazy"
  className="absolute inset-0 h-full w-full object-cover rounded-md"
/>
```

For the carousel images (around line 335), ensure they also have containment. The carousel images should use `object-contain` within a fixed-height container:

```tsx
<img
  src={image.url}
  alt={`${query} result ${idx + 1}`}
  loading="lazy"
  className="max-h-[60vh] w-full object-contain"
/>
```

Note: We're also improving alt text here (see M1 fix — using `query` context instead of generic "Image N").

- [ ] **Step 2: Add dimensions to link-preview.tsx main image**

In `components/tool-ui/link-preview/link-preview.tsx`, the main preview image (around line 93) uses absolute positioning inside a container but has no width/height attributes. The parent container already defines the aspect ratio, so add explicit attributes for the browser's layout engine:

Verify the parent container has a fixed aspect ratio class (e.g., `aspect-video` or equivalent), then ensure the `<img>` has explicit fallback dimensions:

```tsx
<img
  src={image}
  alt=""
  loading="lazy"
  decoding="async"
  width={640}
  height={360}
  className={cn('absolute inset-0 h-full w-full', getFitClass(fit))}
/>
```

The `width`/`height` act as aspect-ratio hints for the browser — they don't affect rendered size since CSS overrides them.

- [ ] **Step 3: Verify and commit**

Run: `bun typecheck && bun lint`
Expected: No errors.

```bash
git add components/search-results-image.tsx components/tool-ui/link-preview/link-preview.tsx
git commit -m "fix(perf): add image dimensions and aspect-ratio containment to prevent CLS"
```

---

### Task 8: Performance — Memoization + Animation

**Fixes:** H6 (ResearchProcessSection), M7 (bar-visualizer will-change), M8 (inline style recreation)

**Files:**

- Modify: `components/research-process-section.tsx:329-409`
- Modify: `components/ui/bar-visualizer.tsx:594-640`

- [ ] **Step 1: Memoize segment content in ResearchProcessSection**

In `components/research-process-section.tsx`, the `onOpenChange` handler at line 386 creates a new closure on every render, causing all collapsible segments to re-render when any one opens/closes.

Wrap the `onOpenChange` in `useCallback`:

```tsx
const handleOpenChange = useCallback(
  (parentId: string) => (open: boolean) => {
    setParentOpenStates(prev => ({ ...prev, [parentId]: open }))
  },
  []
)
```

Then in the JSX, replace the inline handler:

```tsx
onOpenChange={handleOpenChange(parentId)}
```

Also memoize the `groups` computation. Find where `groupConsecutiveParts` is called and wrap in `useMemo`:

```tsx
const groups = useMemo(
  () => groupConsecutiveParts(segment.parts),
  [segment.parts]
)
```

- [ ] **Step 2: Add will-change and use CSS variables in bar-visualizer.tsx**

In `components/ui/bar-visualizer.tsx`, the bar elements around line 625-640 animate height at 30 FPS via inline styles. Add `will-change: height` to hint the browser for GPU compositing, and use a CSS variable instead of direct inline style to reduce object allocation.

Replace the bar's inline style pattern:

```tsx
style={{
  height: `${heightPct}%`,
  animationDuration: state === 'thinking' ? '300ms' : undefined
}}
```

With a CSS variable approach:

```tsx
style={{
  '--bar-h': `${heightPct}%`,
  animationDuration: state === 'thinking' ? '300ms' : undefined
} as React.CSSProperties}
className={cn(barClassName, 'will-change-[height]')}
```

Then in the component's className or a CSS rule, use:

```css
height: var(--bar-h);
```

Note: Tailwind v4 supports `will-change-[height]` as an arbitrary value class.

- [ ] **Step 3: Verify and commit**

Run: `bun typecheck && bun lint`
Expected: No errors.

```bash
git add components/research-process-section.tsx components/ui/bar-visualizer.tsx
git commit -m "fix(perf): memoize research segments, add will-change to bar visualizer"
```

---

### Task 9: Eliminate Duplicate Fetch in Chat History

**Fixes:** H7

**Files:**

- Modify: `components/sidebar/chat-history-client.tsx:52-79`

- [ ] **Step 1: Replace dual timeouts with single fetch + conditional retry**

The current code fires two `setTimeout` calls (800ms and 3000ms) that both call `fetchInitialChats()`. Replace with a single delayed fetch, then check if the data actually updated before retrying.

Find the event handler section (around lines 52-79) with the two timeouts:

```tsx
const t1 = setTimeout(() => {
  startTransition(() => {
    fetchInitialChats()
  })
}, 800)

const t2 = setTimeout(() => {
  startTransition(() => {
    fetchInitialChats()
  })
}, 3000)
```

Replace with a single fetch that uses a retry only if needed:

```tsx
const t1 = setTimeout(() => {
  startTransition(() => {
    fetchInitialChats()
  })
}, 800)
```

Remove the `t2` timeout entirely and its corresponding `clearTimeout(t2)` in the cleanup function.

If a safety-net retry is truly needed (slow DB writes), a better pattern would be to check if the returned data includes the expected chat ID before retrying. But eliminating the unconditional second fetch is the immediate fix.

- [ ] **Step 2: Verify and commit**

Run: `bun typecheck && bun lint`
Expected: No errors.

```bash
git add components/sidebar/chat-history-client.tsx
git commit -m "fix(perf): remove duplicate fetch retry in chat history sidebar"
```

---

### Task 10: Responsive Design Fixes

**Fixes:** H8 (action buttons height), M13 (639px breakpoint), M15 (textarea text sizing)

**Files:**

- Modify: `components/action-buttons.tsx:161`
- Modify: `components/voice/voice-orb.tsx:41`
- Modify: `components/ui/textarea.tsx:12`

- [ ] **Step 1: Add responsive height to action buttons**

In `components/action-buttons.tsx` at line 161, the container uses fixed heights without mobile variants:

```tsx
const containerHeight = isBuildActive ? 'h-[220px]' : 'h-[180px]'
```

Replace with responsive heights that reduce on mobile:

```tsx
const containerHeight = isBuildActive
  ? 'h-[180px] sm:h-[220px]'
  : 'h-[140px] sm:h-[180px]'
```

- [ ] **Step 2: Align JS breakpoint with Tailwind in voice-orb.tsx**

At line 41 in `components/voice/voice-orb.tsx`, the JS media query uses 639px:

```tsx
const mql = window.matchMedia('(max-width: 639px)')
```

This is technically correct (it's the complement of Tailwind's `sm: min-width: 640px`) but for clarity and maintainability, add a comment:

```tsx
// Complement of Tailwind's sm: breakpoint (min-width: 640px)
const mql = window.matchMedia('(max-width: 639px)')
```

This is a low-severity documentation fix — the value is actually correct.

- [ ] **Step 3: Fix counter-intuitive text sizing in textarea**

In `components/ui/textarea.tsx` at line 12, the text gets smaller on desktop:

```tsx
text-base md:text-sm
```

This is actually intentional for iOS zoom prevention — `text-base` (16px) on mobile prevents Safari from zooming into form fields, while `md:text-sm` (14px) gives a more refined look on desktop. Add a comment to prevent future confusion:

```tsx
text-base md:text-sm {/* 16px on mobile prevents iOS zoom; 14px on desktop for refinement */}
```

Wait — comments in className strings don't work. Instead, document this in the component:

```tsx
// text-base on mobile prevents iOS auto-zoom on focus; md:text-sm for desktop refinement
```

Add this as a comment above the className or above the component definition.

- [ ] **Step 4: Verify and commit**

Run: `bun typecheck && bun lint`
Expected: No errors.

```bash
git add components/action-buttons.tsx components/voice/voice-orb.tsx components/ui/textarea.tsx
git commit -m "fix(responsive): add mobile height variants, document breakpoint decisions"
```

---

### Task 11: Minor Accessibility Improvements

**Fixes:** M1 (generic alt text), M2 (decorative icons missing aria-hidden)

**Files:**

- Modify: `components/section.tsx:40-71`
- Modify: `components/related-questions.tsx:26`
- Modify: `components/search-results-image.tsx:305,335` (alt text — may already be fixed in Task 7)

- [ ] **Step 1: Add aria-hidden to decorative section icons**

In `components/section.tsx`, the icons for section headers (lines 40-71) are decorative — the section title already provides the semantic meaning. Add `aria-hidden="true"` to each icon.

For every icon assignment in the switch/conditional block, add the prop. For example:

```tsx
icon = (
  <ImageIcon size={iconSize} className={iconClassName} aria-hidden="true" />
)
```

Apply to all icon instances in this block (Search, Image, Film, Globe, etc.).

- [ ] **Step 2: Add aria-hidden to related questions arrow**

In `components/related-questions.tsx` at line 26:

Find:

```tsx
<ArrowRight
```

Add `aria-hidden="true"`:

```tsx
<ArrowRight aria-hidden="true"
```

- [ ] **Step 3: Improve alt text on search result images**

If not already addressed in Task 7, update the generic `alt={`Image ${N}`}` text in `components/search-results-image.tsx` to include search context.

The component should have access to the query or title. Update both instances:

Grid images (~line 305):

```tsx
alt={`Search result image ${actualIndex + 1}`}
```

Carousel images (~line 335):

```tsx
alt={`Search result image ${idx + 1}`}
```

If the component has access to the search query prop, prefer:

```tsx
alt={`${query} - image ${actualIndex + 1}`}
```

- [ ] **Step 4: Verify and commit**

Run: `bun typecheck && bun lint`
Expected: No errors.

```bash
git add components/section.tsx components/related-questions.tsx components/search-results-image.tsx
git commit -m "fix(a11y): add aria-hidden to decorative icons, improve image alt text"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] Run `bun typecheck` — zero errors
- [ ] Run `bun lint` — zero warnings
- [ ] Run `bun run build` — successful production build
- [ ] Visual check: light mode renders correctly
- [ ] Visual check: dark mode renders correctly
- [ ] Visual check: voice orb maintains dark aesthetic in both themes
- [ ] Keyboard test: Tab through image gallery, verify focus rings visible
- [ ] Keyboard test: Enter/Space activates image selection
- [ ] Screen reader test: Auth form errors announced, password toggle labeled
