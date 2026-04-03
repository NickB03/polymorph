# Mobile UI/UX Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the highest-severity mobile UX issues from the Polymorph shell, composer, and auth flows without changing product scope.

**Architecture:** Fix the mobile issues at the shared shell/component layer instead of patching pages one-by-one. Prioritize always-visible first paint, 44x44 touch targets, accessible hidden states, and responsive action layouts, then tighten auth-specific polish and add focused regression tests around the touched components.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library

---

## File Structure

**Modify**

- `components/ui/sidebar.tsx` — remove hydration-time shell hiding, enlarge the shared sidebar trigger, and restore a clear mobile close affordance.
- `components/app-sidebar.tsx` — suppress the shared sidebar on auth routes so auth pages render without app-shell chrome.
- `components/header.tsx` — reduce noisy mobile chrome on auth routes and preserve the main chat shell behavior.
- `components/guest-menu.tsx` — expand guest menu trigger to a mobile-safe hit target.
- `components/user-menu.tsx` — expand signed-in avatar trigger to a mobile-safe hit target.
- `components/drag-overlay.tsx` — hide inactive overlay content from the accessibility tree.
- `components/action-buttons.tsx` — enlarge quick-action targets, add focus-visible treatment, and make the build grid/container responsive.
- `components/chat-panel.tsx` — keep the empty-state composer layout aligned with the updated action area.
- `components/login-form.tsx` — fix the password/forgot-password row on narrow mobile widths.
- `components/user-text-section.tsx` — enlarge the edit-message affordance on mobile.

**Create**

- `components/ui/sidebar.test.tsx` — regression coverage for visible shell rendering and mobile trigger sizing.
- `components/drag-overlay.test.tsx` — regression coverage for inactive overlay accessibility behavior.
- `components/action-buttons.test.tsx` — regression coverage for mobile target sizing and focusable controls.
- `components/login-form.test.tsx` — regression coverage for the narrow password row layout classes.

**Existing Tests to Update**

- `components/chat-panel.test.tsx` — stop mocking away `ActionButtons` and verify the empty-state composer still renders correctly with the revised action layout.

---

### Task 1: Remove Blank First Paint And Fix Mobile Shell Touch Targets

**Files:**

- Modify: `components/ui/sidebar.tsx`
- Modify: `components/guest-menu.tsx`
- Modify: `components/user-menu.tsx`
- Modify: `components/header.tsx`
- Modify: `components/user-text-section.tsx`
- Create: `components/ui/sidebar.test.tsx`

- [ ] **Step 1: Write the failing sidebar-shell regression tests**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SidebarProvider, SidebarTrigger } from './sidebar'

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true
}))

describe('Sidebar mobile shell', () => {
  it('does not hide the shell before hydration', () => {
    const { container } = render(
      <SidebarProvider defaultOpen>
        <div>content</div>
      </SidebarProvider>
    )

    expect(container.firstElementChild?.className).not.toContain('opacity-0')
  })

  it('renders a 44x44 sidebar trigger hit target', () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarTrigger />
      </SidebarProvider>
    )

    expect(
      screen.getByRole('button', { name: /toggle sidebar/i }).className
    ).toContain('h-11')
  })
})
```

- [ ] **Step 2: Run the new test file to verify it fails**

Run: `bun run test -- components/ui/sidebar.test.tsx`
Expected: FAIL because the wrapper still uses `opacity-0` before hydration and the trigger still renders at `size-6`.

- [ ] **Step 3: Implement the shared shell fixes**

```tsx
// components/ui/sidebar.tsx
const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn('h-11 w-11 rounded-full', className)}
      onClick={event => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft size={18} />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})

// render the wrapper immediately instead of gating it behind opacity-0
className={cn(
  'group/sidebar-wrapper flex h-[100dvh] w-full has-data-[variant=inset]:bg-sidebar',
  isHydrated && 'transition-opacity duration-150',
  className
)}

// components/guest-menu.tsx
<Button variant="ghost" size="icon" className="h-11 w-11 rounded-full">

// components/user-menu.tsx
<Button variant="ghost" className="relative h-11 w-11 rounded-full">
  <Avatar className="h-9 w-9">

// components/user-text-section.tsx
<Button
  variant="ghost"
  size="icon"
  className="rounded-full h-11 w-11"
  onClick={handleEditClick}
  aria-label="Edit message"
>

// components/header.tsx
const isAuthPage = pathname.startsWith('/auth/')
const showHeaderMenus = !isAuthPage
```

- [ ] **Step 4: Restore a clear close affordance for the mobile sheet**

```tsx
// components/ui/sidebar.tsx
<SheetContent
  data-sidebar="sidebar"
  data-mobile="true"
  className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground"
  style={
    {
      '--sidebar-width': SIDEBAR_WIDTH_MOBILE
    } as React.CSSProperties
  }
  side={side}
>
```

Run: `bun run test -- components/ui/sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/ui/sidebar.tsx components/guest-menu.tsx components/user-menu.tsx components/header.tsx components/user-text-section.tsx components/ui/sidebar.test.tsx
git commit -m "fix: improve mobile shell visibility and touch targets"
```

---

### Task 2: Hide Inactive Overlay Content From Assistive Tech

**Files:**

- Modify: `components/drag-overlay.tsx`
- Create: `components/drag-overlay.test.tsx`

- [ ] **Step 1: Write the failing drag overlay accessibility test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DragOverlay } from './drag-overlay'

describe('DragOverlay', () => {
  it('hides its content from assistive tech when inactive', () => {
    render(<DragOverlay visible={false} />)

    expect(
      screen.getByText('Drop files here').parentElement?.parentElement
    ).toHaveAttribute('aria-hidden', 'true')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- components/drag-overlay.test.tsx`
Expected: FAIL because the inactive overlay is still accessible in the DOM tree.

- [ ] **Step 3: Implement the minimal accessibility fix**

```tsx
export function DragOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'absolute inset-0 z-40 flex items-center justify-center backdrop-blur-md transition-opacity duration-200 pointer-events-none',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div className="text-center text-muted-foreground">
        <UploadCloud className="mx-auto mb-4 w-10 h-10" />
        <p className="text-lg font-semibold">Drop files here</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- components/drag-overlay.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/drag-overlay.tsx components/drag-overlay.test.tsx
git commit -m "fix: hide inactive drag overlay from assistive tech"
```

---

### Task 3: Make The Empty-State Action Area Responsive And Keyboard-Visible

**Files:**

- Modify: `components/action-buttons.tsx`
- Modify: `components/chat-panel.tsx`
- Create: `components/action-buttons.test.tsx`
- Modify: `components/chat-panel.test.tsx`

- [ ] **Step 1: Write the failing action-area regression tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ActionButtons } from './action-buttons'

describe('ActionButtons mobile layout', () => {
  const promptSamples = {
    research: ['Research prompt'],
    compare: ['Compare prompt'],
    latest: ['Latest prompt'],
    summarize: ['Summarize prompt'],
    explain: ['Explain prompt']
  }

  it('uses 44px-tall quick action buttons', () => {
    render(
      <ActionButtons
        inputRef={{ current: null }}
        onSelectPrompt={vi.fn()}
        onCategoryClick={vi.fn()}
        onBuildTemplateSelect={vi.fn()}
        promptSamples={promptSamples}
        canvasEnabled
      />
    )

    expect(
      screen.getByRole('button', { name: /research/i }).className
    ).toContain('h-11')
  })

  it('renders build templates with a mobile-safe responsive grid', () => {
    render(
      <ActionButtons
        inputRef={{ current: null }}
        onSelectPrompt={vi.fn()}
        onCategoryClick={vi.fn()}
        onBuildTemplateSelect={vi.fn()}
        promptSamples={promptSamples}
        canvasEnabled
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /build/i }))

    expect(
      screen.getByRole('button', { name: /websites/i }).parentElement?.className
    ).toContain('grid-cols-2')
  })
})
```

- [ ] **Step 2: Run the action-area tests to verify they fail**

Run: `bun run test -- components/action-buttons.test.tsx`
Expected: FAIL because buttons still use `size="sm"` and the build grid is still fixed at `grid-cols-3`.

- [ ] **Step 3: Implement the mobile sizing and responsive layout changes**

```tsx
// components/action-buttons.tsx
const containerHeight = isBuildActive
  ? 'min-h-[220px] h-auto sm:h-[220px]'
  : 'min-h-[180px] h-auto sm:h-[180px]'

<Button
  key={category.key}
  type="button"
  variant="outline"
  size="default"
  className={cn(
    'flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full animate-content-enter',
    'text-sm px-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  )}
>

<button
  type="button"
  className={cn(
    'w-full text-left px-3 py-3 rounded-md text-sm',
    'hover:bg-muted transition-colors',
    'flex items-center gap-2 group',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  )}
>

<div className="grid grid-cols-2 gap-3 h-full sm:grid-cols-3">
  <button
    type="button"
    className="group flex min-h-11 flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
  >

// components/chat-panel.tsx
<div className="flex items-center justify-between gap-2 p-3">
```

- [ ] **Step 4: Update the existing chat panel test with the new empty-state expectations**

```tsx
// components/chat-panel.test.tsx
vi.mock('@/hooks/use-trending-suggestions', () => ({
  useTrendingSuggestions: () => ({
    suggestions: {
      research: ['Research prompt'],
      compare: ['Compare prompt'],
      latest: ['Latest prompt'],
      summarize: ['Summarize prompt'],
      explain: ['Explain prompt']
    }
  })
}))

// Remove the ActionButtons test double so this assertion covers the real empty-state controls

it('keeps the empty-state composer actions accessible on mobile', () => {
  render(
    <ChatPanel
      chatId="chat-1"
      input=""
      handleInputChange={vi.fn()}
      handleSubmit={e => e.preventDefault()}
      status="ready"
      messages={[]}
      stop={vi.fn()}
      append={vi.fn()}
      showScrollToBottomButton={false}
      scrollContainerRef={{ current: null }}
      uploadedFiles={[]}
      setUploadedFiles={vi.fn()}
      isGuest
    />
  )

  expect(screen.getByRole('button', { name: /research/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /build/i })).toBeInTheDocument()
})
```

Run:

- `bun run test -- components/action-buttons.test.tsx`
- `bun run test -- components/chat-panel.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/action-buttons.tsx components/chat-panel.tsx components/action-buttons.test.tsx components/chat-panel.test.tsx
git commit -m "fix: improve mobile composer action layout"
```

---

### Task 4: Fix Auth Flow Mobile Layout And Reduce Floating Chrome

**Files:**

- Modify: `components/app-sidebar.tsx`
- Modify: `components/header.tsx`
- Modify: `components/login-form.tsx`
- Create: `components/login-form.test.tsx`

- [ ] **Step 1: Write the failing auth-layout regression test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LoginForm } from './login-form'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}))

describe('LoginForm', () => {
  it('allows the password row to wrap on narrow screens', () => {
    render(<LoginForm />)

    expect(screen.getByText('Password').parentElement?.className).toContain(
      'flex-wrap'
    )
  })
})
```

- [ ] **Step 2: Run the auth-layout test to verify it fails**

Run: `bun run test -- components/login-form.test.tsx`
Expected: FAIL because the password row still uses a single-line flex layout.

- [ ] **Step 3: Implement the auth fixes**

```tsx
// components/login-form.tsx
<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
  <Label htmlFor="password">Password</Label>
  <Link
    href="/auth/forgot-password"
    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
  >
    Forgot password?
  </Link>
</div>

// components/app-sidebar.tsx
import { usePathname, useRouter } from 'next/navigation'

const pathname = usePathname()
const isAuthPage = pathname.startsWith('/auth/')

if (isAuthPage) {
  return null
}

// components/header.tsx
const isAuthPage = pathname.startsWith('/auth/')

return (
  <>
    {!isAuthPage && (
      <header className={cn(/* existing header classes */)}>
        {/* existing controls */}
      </header>
    )}
```

- [ ] **Step 4: Run the auth regression test and a focused shell test**

Run:

- `bun run test -- components/login-form.test.tsx`
- `bun run test -- components/ui/sidebar.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/app-sidebar.tsx components/header.tsx components/login-form.tsx components/login-form.test.tsx
git commit -m "fix: improve mobile auth layout and reduce chrome"
```

---

### Task 5: Final Verification

**Files:**

- Modify: none
- Test: `components/ui/sidebar.test.tsx`
- Test: `components/drag-overlay.test.tsx`
- Test: `components/action-buttons.test.tsx`
- Test: `components/chat-panel.test.tsx`
- Test: `components/login-form.test.tsx`

- [ ] **Step 1: Run the focused component suite**

Run:

- `bun run test -- components/ui/sidebar.test.tsx`
- `bun run test -- components/drag-overlay.test.tsx`
- `bun run test -- components/action-buttons.test.tsx`
- `bun run test -- components/chat-panel.test.tsx`
- `bun run test -- components/login-form.test.tsx`

Expected: all PASS

- [ ] **Step 2: Run project-level verification**

Run:

- `bun lint`
- `bun typecheck`

Expected:

- `eslint .` exits 0
- `tsc --noEmit` exits 0

- [ ] **Step 3: Run a manual mobile smoke test**

Run:

- `bun dev`
- Open `http://127.0.0.1:43100` in an iPhone-sized viewport
- Open `http://127.0.0.1:43100/auth/login` in an iPhone-sized viewport

Expected:

- no blank first paint
- visible 44x44 mobile controls
- no stray “Drop files here” announcement at rest
- quick-action pills feel thumb-safe
- auth page no longer shows app sidebar or top-right shell menus
- auth page no longer shows clipped password-row content

- [ ] **Step 4: Commit the verification state**

```bash
git status
```

Expected: clean working tree except for intended mobile UX changes

---

## Self-Review

**Spec coverage:** This plan covers the high-severity hydration blank state, undersized shell controls, inactive overlay accessibility issue, under-sized empty-state actions, weak keyboard focus for custom buttons, and the auth-page mobile row overflow.

**Placeholder scan:** No `TODO`, `TBD`, or deferred implementation notes remain.

**Type consistency:** All paths, component names, and commands match the current repository structure reviewed during planning.

Plan complete and saved to `docs/superpowers/plans/2026-04-03-mobile-ui-ux-remediation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
