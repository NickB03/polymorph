# Admin Route Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the admin surface into its own route group with a dedicated left-sidebar chrome, so `/evals` (and future admin pages) no longer render the chat sidebar. Move the single existing admin page to `/admin/evals`.

**Architecture:** Introduce two sibling route groups under `app/`: `(chat)` and `(admin)`. Keep a single slim root `layout.tsx` that owns `<html>`, `<body>`, fonts, `ThemeProvider`, `Toaster`, and `Analytics`. `(chat)/layout.tsx` re-hosts the existing chat chrome (SidebarProvider + AppSidebar + Header + CanvasRoot). `(admin)/layout.tsx` runs the admin auth gate once and renders a new `AdminSidebar` plus a thin admin header. Navigation between groups stays client-side because a single root layout is preserved.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), shadcn/ui, Tailwind v4, Vitest + React Testing Library, Bun.

**Wireframe spec:** `polymorph.pen` frame "Admin Shell — /admin/evals" (node `C8Cke`). Left sidebar 260px, 6 flat items (Evals active, Feedback/Traffic/Users/Flags/Settings placeholder), back-to-chat link at top, small "ADMIN" pill using `$--accent-blue`, user row at bottom. 56px admin top bar with page title + env pill.

**Commit convention:** Conventional commits, type `(scope)`, lowercase: `refactor(app)`, `feat(admin)`, `chore(app)`. Recent examples: `fix(search): typed provider errors`, `feat(evals): template-driven dashboard`.

**Prereqs before starting:**

- Confirm working tree is clean except for the two files listed in `git status` at session start (`components/evals/dashboard-v2/template-switcher.tsx`, `polymorph.pen`). Either commit or stash those first — they are unrelated to this plan.
- Run `bun install` if needed.
- Confirm `bun dev` starts on port 43100 and loads `/` with the chat sidebar.
- Confirm `/evals` currently loads (you are admin via `ADMIN_USER_ID`) and renders the evals dashboard with the chat sidebar visible — this is the regression baseline.

---

## File Structure

**New files:**

- `app/(chat)/layout.tsx` — hosts chat chrome (SidebarProvider, AppSidebar, Header, CanvasRoot) and runs the supabase user fetch for `hasUser` / `isAdmin` props. Server component.
- `app/(admin)/layout.tsx` — runs `getCurrentUser` + `isAdminUserId` gate, renders `AdminSidebar` + admin top bar. Server component.
- `app/(admin)/layout.test.tsx` — gate behavior (redirect unauth, 404 non-admin, render admin).
- `components/admin/admin-sidebar.tsx` — client component: shadcn `Sidebar` with flat nav list, back-to-chat, ADMIN pill, user row.
- `components/admin/admin-sidebar.test.tsx` — renders nav items, active-state from pathname, back link.

**Modified files:**

- `app/layout.tsx` — slimmed to root essentials; chat chrome removed.
- `components/app-sidebar.tsx` — remove obsolete `/auth/*` early return (line 39).
- `components/header.tsx` — remove obsolete `isAuthPage` guard (lines 28, 32).
- `components/user-menu.tsx:195` — change `href="/evals"` → `href="/admin/evals"`.

**Moved files (git mv):**

- `app/page.tsx` → `app/(chat)/page.tsx`
- `app/search/` → `app/(chat)/search/` (entire directory, including `[id]/page.tsx`, `loading.tsx`, `question-wizard/`)
- `app/demo/` → `app/(chat)/demo/` (entire directory)
- `app/evals/page.tsx` → `app/(admin)/admin/evals/page.tsx` (and trim inline gate — layout owns it)
- `app/evals/loading.tsx` → `app/(admin)/admin/evals/loading.tsx`
- `app/evals/page.test.tsx` → `app/(admin)/admin/evals/page.test.tsx` (and trim redirect/notFound tests — moved to layout test)

**Unchanged:**

- `app/auth/*` — stays at root. Now gets only the slim root layout (no chrome), which is the desired behavior.
- `app/api/*` — no chrome involvement.
- `app/error.tsx`, `app/manifest.ts`, `app/globals.css`, `app/fonts/`, `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`, `app/opengraph-image.png` — root-owned assets.
- `components/app-sidebar.tsx` (except the one guard removal) — stays chat-only; still imported from `(chat)/layout.tsx`.
- `components/header.tsx` (except the one guard removal) — stays chat-only.
- `components/evals/dashboard-v2/dashboard.tsx` and all eval widgets — dashboard body is untouched.

---

## Task 1: Introduce `(chat)` route group and slim the root layout

**Why this task:** The root layout currently hardcodes the chat shell. Before we can give admin a different chrome, the chat chrome must move to its own layout so admin can have a sibling layout with its own chrome.

**Files:**

- Create: `app/(chat)/layout.tsx`
- Modify: `app/layout.tsx`
- Move (git mv): `app/page.tsx` → `app/(chat)/page.tsx`

### Steps

- [ ] **Step 1: Create `app/(chat)/` directory**

```bash
mkdir -p "app/(chat)"
```

- [ ] **Step 2: Move the chat home page into the route group**

```bash
git mv app/page.tsx "app/(chat)/page.tsx"
```

- [ ] **Step 3: Verify the move**

Run: `ls "app/(chat)/"`
Expected: `page.tsx` listed.

- [ ] **Step 4: Create `app/(chat)/layout.tsx` with the full chat chrome**

Create `app/(chat)/layout.tsx`:

```tsx
import { isAdminUserId } from '@/lib/auth/is-admin'
import { createClient } from '@/lib/supabase/server'

import { SidebarProvider } from '@/components/ui/sidebar'

import AppSidebar from '@/components/app-sidebar'
import { CanvasRoot } from '@/components/canvas/canvas-root'
import Header from '@/components/header'

export default async function ChatLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  let user = null
  let isAdmin = false
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = await createClient()
    const {
      data: { user: supabaseUser }
    } = await supabase.auth.getUser()
    user = supabaseUser
    isAdmin = isAdminUserId(supabaseUser?.id)
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar hasUser={!!user} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header user={user} isAdmin={isAdmin} />
        <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <CanvasRoot>{children}</CanvasRoot>
        </main>
      </div>
    </SidebarProvider>
  )
}
```

- [ ] **Step 5: Slim `app/layout.tsx` to root essentials**

Replace the entire contents of `app/layout.tsx` with:

```tsx
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import { Analytics } from '@vercel/analytics/next'

import { cn } from '@/lib/utils'
import { createAppMetadata } from '@/lib/utils/app-metadata'

import { Toaster } from '@/components/ui/sonner'

import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'

const fontSans = localFont({
  src: './fonts/inter-latin-variable.woff2',
  variable: '--font-sans',
  display: 'swap'
})

export const metadata: Metadata = createAppMetadata()

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen flex flex-col font-sans antialiased overflow-hidden pb-safe',
          fontSans.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
```

Note: `RootLayout` is no longer `async` (no more supabase call here). `SidebarProvider`, `AppSidebar`, `Header`, `CanvasRoot` imports are removed — they live in `(chat)/layout.tsx` now.

- [ ] **Step 6: Typecheck**

Run: `bun typecheck`
Expected: passes with zero errors. If any error mentions a removed import in `app/layout.tsx`, re-check Step 5.

- [ ] **Step 7: Lint**

Run: `bun lint`
Expected: passes. Fix any warning introduced by the change.

- [ ] **Step 8: Boot dev server and smoke-test the home route**

Run: `bun dev`
Open `http://localhost:43100/` in a browser.
Expected:

- Chat sidebar renders on the left (as before).
- Home page renders (Chat component).
- No console errors about missing `SidebarProvider` or missing `useSidebar`.

Kill the dev server with Ctrl+C before continuing.

- [ ] **Step 9: Commit**

```bash
git add "app/(chat)/layout.tsx" "app/(chat)/page.tsx" app/layout.tsx
git commit -m "refactor(app): extract chat chrome into (chat) route group"
```

---

## Task 2: Move remaining chat routes into `(chat)` and drop obsolete `/auth` guards

**Why this task:** `app/search/` and `app/demo/` are chat-surface pages that need the chat chrome. Moving them into `(chat)` keeps them working identically. Once the structure is in place, the pathname-based `/auth/*` early-returns in `AppSidebar` and `Header` become unreachable dead code — `/auth/*` routes no longer mount those components at all.

**Files:**

- Move: `app/search/` → `app/(chat)/search/` (directory)
- Move: `app/demo/` → `app/(chat)/demo/` (directory)
- Modify: `components/app-sidebar.tsx` (remove line 39 guard + related imports if unused)
- Modify: `components/header.tsx` (remove `isAuthPage` logic)

### Steps

- [ ] **Step 1: Move `app/search/` into the chat route group**

```bash
git mv app/search "app/(chat)/search"
```

- [ ] **Step 2: Move `app/demo/` into the chat route group**

```bash
git mv app/demo "app/(chat)/demo"
```

- [ ] **Step 3: Verify the moves**

Run: `ls "app/(chat)/" app/`
Expected:

- `app/(chat)/` contains: `demo`, `layout.tsx`, `page.tsx`, `search`.
- `app/` no longer lists `demo`, `page.tsx`, or `search` at top level. It still lists `api`, `auth`, `error.tsx`, `evals`, `fonts`, `globals.css`, `layout.tsx`, `manifest.ts`, and image assets.

- [ ] **Step 4: Remove the obsolete `/auth/*` guard in `AppSidebar`**

Modify `components/app-sidebar.tsx`. Find line 39:

```tsx
if (pathname.startsWith('/auth/')) return null
```

Delete it. Also remove the now-unused `usePathname` import if no other code in the file uses it.

Verify the imports after edit. Current imports include `usePathname` from `next/navigation` at line 5; check if anything else in the file references `pathname`. The only other reference is the deleted line. So the import must be removed.

Updated top of file (lines 1–6):

```tsx
'use client'

import { Suspense, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { SquarePen } from 'lucide-react'
```

Also remove the `const pathname = usePathname()` line inside the component (was line 26).

- [ ] **Step 5: Remove the obsolete `isAuthPage` guard in `Header`**

Modify `components/header.tsx`.

- Line 5: `import { usePathname } from 'next/navigation'` — keep, still used for `isRootPage`.
- Line 28: delete `const isAuthPage = pathname.startsWith('/auth/')`
- Lines 32 and 64: the entire `{!isAuthPage && (...)}` conditional wrapper must be removed. The `<header>` element should render unconditionally.

After edit, the return block should look like:

```tsx
return (
  <>
    <header
      className={cn(
        'absolute top-0 right-0 p-3 flex justify-between items-center z-10 backdrop-blur-sm lg:backdrop-blur-none bg-background/80 lg:bg-transparent transition-[width] duration-200 ease-linear',
        open ? 'md:w-[calc(100%-var(--sidebar-width))]' : 'md:w-full',
        'w-full'
      )}
    >
      <div>
        {(!open || isMobile) && <SidebarTrigger className="animate-fade-in" />}
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <UserMenu
            user={user}
            isAdmin={isAdmin}
            onFeedbackClick={
              isRootPage ? () => setFeedbackOpen(true) : undefined
            }
          />
        ) : (
          <GuestMenu
            onFeedbackClick={
              isRootPage ? () => setFeedbackOpen(true) : undefined
            }
          />
        )}
      </div>
    </header>

    {isRootPage && (
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    )}
  </>
)
```

- [ ] **Step 6: Typecheck**

Run: `bun typecheck`
Expected: passes. If it errors on `usePathname` being imported-but-unused in `app-sidebar.tsx`, you missed the cleanup in Step 4.

- [ ] **Step 7: Lint**

Run: `bun lint`
Expected: passes.

- [ ] **Step 8: Run relevant tests**

Run: `bun run test`
Expected: all tests pass. No test file moved yet, so everything should still pass.

- [ ] **Step 9: Smoke test chat routes + auth route**

Run: `bun dev`

- Open `http://localhost:43100/` — chat sidebar visible, Chat component renders.
- Open `http://localhost:43100/search/some-id` — may 404 or load depending on `[id]` handler; chat sidebar should be visible; no console errors.
- Open `http://localhost:43100/demo/question-wizard` — loads; chat sidebar visible.
- Open `http://localhost:43100/auth/login` — login form renders; **no chat sidebar, no header** (this is the new correct behavior — no chrome without a layout wrapping it).

Kill the dev server.

- [ ] **Step 10: Commit**

```bash
git add "app/(chat)/search" "app/(chat)/demo" components/app-sidebar.tsx components/header.tsx
git commit -m "refactor(app): move chat routes into (chat) group and drop obsolete /auth guards"
```

---

## Task 3: Build `AdminSidebar` component (TDD)

**Why this task:** The admin route group needs its own sidebar distinct from `AppSidebar`. Per the wireframe: 6 flat nav items, a back-to-chat link at the top, an ADMIN pill, and a user row at the bottom. We build it in isolation with tests first so it is usable the moment the layout mounts it.

**Files:**

- Create: `components/admin/admin-sidebar.tsx`
- Create: `components/admin/admin-sidebar.test.tsx`

### Steps

- [ ] **Step 1: Create the admin components directory**

```bash
mkdir -p components/admin
```

- [ ] **Step 2: Write the failing test**

Create `components/admin/admin-sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'

import { AdminSidebar } from './admin-sidebar'

const mockUsePathname = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', async () => {
  const actual =
    await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return { ...actual, usePathname: mockUsePathname }
})

function renderInProvider(ui: React.ReactElement) {
  return render(<SidebarProvider defaultOpen>{ui}</SidebarProvider>)
}

describe('AdminSidebar', () => {
  it('renders all admin nav items', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    expect(screen.getByRole('link', { name: /evals/i })).toBeInTheDocument()
    expect(screen.getByText(/feedback/i)).toBeInTheDocument()
    expect(screen.getByText(/traffic/i)).toBeInTheDocument()
    expect(screen.getByText(/users/i)).toBeInTheDocument()
    expect(screen.getByText(/flags/i)).toBeInTheDocument()
    expect(screen.getByText(/settings/i)).toBeInTheDocument()
  })

  it('renders a back-to-chat link at the top', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    const backLink = screen.getByRole('link', { name: /back to chat/i })
    expect(backLink).toHaveAttribute('href', '/')
  })

  it('marks the nav item matching the current pathname as active', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    const evalsLink = screen.getByRole('link', { name: /evals/i })
    expect(evalsLink).toHaveAttribute('data-active', 'true')
  })

  it('shows the ADMIN label', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    expect(screen.getByText(/^admin$/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `bun run test -- components/admin/admin-sidebar.test.tsx`
Expected: FAIL — `Cannot find module './admin-sidebar'` or similar "module not found" error.

- [ ] **Step 4: Implement `AdminSidebar`**

Create `components/admin/admin-sidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Activity,
  ArrowLeft,
  ChartColumnIncreasing,
  Flag,
  MessageSquare,
  Settings,
  Users
} from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from '@/components/ui/sidebar'

type AdminNavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: 'Evals', href: '/admin/evals', icon: ChartColumnIncreasing },
  {
    label: 'Feedback',
    href: '/admin/feedback',
    icon: MessageSquare,
    disabled: true
  },
  { label: 'Traffic', href: '/admin/traffic', icon: Activity, disabled: true },
  { label: 'Users', href: '/admin/users', icon: Users, disabled: true },
  { label: 'Flags', href: '/admin/flags', icon: Flag, disabled: true },
  { label: 'Settings', href: '/admin/settings', icon: Settings, disabled: true }
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="flex flex-row items-center justify-between px-2 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold tracking-tight text-foreground select-none">
            pm
          </span>
          <span className="rounded-full border border-[color:var(--accent-blue)]/30 bg-[color:var(--accent-blue)]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[color:var(--accent-blue)] uppercase">
            Admin
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="size-4" />
                <span>Back to chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {ADMIN_NAV_ITEMS.map(item => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    className={cn(
                      item.disabled && 'pointer-events-none opacity-50'
                    )}
                  >
                    <Link
                      href={item.disabled ? '#' : item.href}
                      aria-disabled={item.disabled}
                      data-active={active ? 'true' : 'false'}
                      className="flex items-center gap-2"
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 py-3 border-t border-sidebar-border">
        <div className="text-xs text-muted-foreground">Admin workspace</div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
```

Design notes embedded in this component:

- The ADMIN pill uses `var(--accent-blue)` (the token added to `polymorph.pen` earlier). Confirm that `app/globals.css` defines `--accent-blue`. If it does not, either add it to `:root` in `app/globals.css` matching `.impeccable.md`'s OKLCH value (`oklch(0.546 0.245 263)`), or fall back to a Tailwind class like `border-blue-500/30 bg-blue-500/10 text-blue-600` for now. **Do this check in Step 5 before running the test.**
- All items except `Evals` render as disabled placeholders — the wireframe's intent. They are rendered as links with `aria-disabled` and `pointer-events-none` so structure is stable for future implementation.
- The user row at the sidebar bottom is intentionally minimal in v1 — chat `Header` handles auth. Revisit later if admin needs its own signout.

- [ ] **Step 5: Confirm `--accent-blue` is defined in `app/globals.css`**

Run: `grep -n "accent-blue" app/globals.css`

If no match:

- Open `app/globals.css`.
- Find the `:root { ... }` block (or the block that defines CSS variables, typically near the top).
- Add `--accent-blue: oklch(0.546 0.245 263);` inside it.
- If there is a `.dark { ... }` block, add a slightly lighter variant: `--accent-blue: oklch(0.66 0.18 263);` (rough hex `#5B8DEF`, matching the wireframe's dark-theme value).

If the search returns a match, leave it alone.

- [ ] **Step 6: Run the AdminSidebar test and confirm it passes**

Run: `bun run test -- components/admin/admin-sidebar.test.tsx`
Expected: all 4 tests pass.

If `data-active` assertion fails: confirm the `data-active={active ? 'true' : 'false'}` attribute is on the inner `<Link>` element (the element returned by the link role query), not the button.

- [ ] **Step 7: Typecheck + lint**

Run: `bun typecheck`
Run: `bun lint`
Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add components/admin/ app/globals.css
git commit -m "feat(admin): add AdminSidebar with flat nav and back-to-chat link"
```

(Omit `app/globals.css` from the commit if Step 5 did not modify it.)

---

## Task 4: Create `(admin)` layout with auth gate (TDD)

**Why this task:** The admin route group needs a single gate — any unauthenticated visitor redirects to `/auth/login`, any non-admin hits `notFound()`. Gating at the layout (not the page) means future admin pages inherit the gate automatically and cannot accidentally leak.

**Files:**

- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/layout.test.tsx`

### Steps

- [ ] **Step 1: Create the `(admin)` directory**

```bash
mkdir -p "app/(admin)"
```

- [ ] **Step 2: Write the failing test**

Create `app/(admin)/layout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockRedirect = vi.hoisted(() => vi.fn())
const mockNotFound = vi.hoisted(() => vi.fn())
const mockGetCurrentUser = vi.hoisted(() => vi.fn())
const mockIsAdminUserId = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
  usePathname: () => '/admin/evals'
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: mockGetCurrentUser
}))

vi.mock('@/lib/auth/is-admin', () => ({
  isAdminUserId: mockIsAdminUserId
}))

vi.mock('@/components/admin/admin-sidebar', () => ({
  AdminSidebar: () => <aside data-testid="admin-sidebar" />
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-provider">{children}</div>
  )
}))

describe('(admin) layout', () => {
  it('redirects logged-out users to /auth/login', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const { default: AdminLayout } = await import('./layout')
    await AdminLayout({ children: <div>child</div> })

    expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
  })

  it('returns 404 for non-admin users', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'non-admin' })
    mockIsAdminUserId.mockReturnValue(false)

    const { default: AdminLayout } = await import('./layout')
    await AdminLayout({ children: <div>child</div> })

    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders the admin chrome and children for admin users', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mockIsAdminUserId.mockReturnValue(true)

    const { default: AdminLayout } = await import('./layout')
    const result = await AdminLayout({
      children: <div data-testid="admin-child">hello</div>
    })
    render(result as React.ReactElement)

    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('admin-child')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `bun run test -- "app/(admin)/layout.test.tsx"`
Expected: FAIL — "Cannot find module './layout'".

- [ ] **Step 4: Implement `app/(admin)/layout.tsx`**

Create `app/(admin)/layout.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isAdminUserId } from '@/lib/auth/is-admin'

import { SidebarProvider } from '@/components/ui/sidebar'

import { AdminSidebar } from '@/components/admin/admin-sidebar'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login')
    return null
  }

  if (!isAdminUserId(user.id)) {
    notFound()
    return null
  }

  return (
    <SidebarProvider defaultOpen>
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `bun run test -- "app/(admin)/layout.test.tsx"`
Expected: all 3 tests pass.

- [ ] **Step 6: Typecheck + lint**

Run: `bun typecheck`
Run: `bun lint`
Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add "app/(admin)/layout.tsx" "app/(admin)/layout.test.tsx"
git commit -m "feat(admin): add (admin) route group with auth gate layout"
```

---

## Task 5: Move the evals page to `/admin/evals`

**Why this task:** With the `(admin)` group in place, the single existing admin page moves to `/admin/evals`. The page itself loses its inline auth/admin checks (the layout owns them now) and drops its outer padding wrapper (the layout's `<main>` owns layout now). The existing page test moves too, minus the redirect/notFound cases that are covered by the layout test.

**Files:**

- Move (git mv): `app/evals/page.tsx` → `app/(admin)/admin/evals/page.tsx`
- Move (git mv): `app/evals/loading.tsx` → `app/(admin)/admin/evals/loading.tsx`
- Move (git mv): `app/evals/page.test.tsx` → `app/(admin)/admin/evals/page.test.tsx`
- Modify: the moved `page.tsx` (strip inline gate + outer wrapper)
- Modify: the moved `page.test.tsx` (drop redirect/notFound cases)
- Delete: the now-empty `app/evals/` directory

### Steps

- [ ] **Step 1: Create the destination directory**

```bash
mkdir -p "app/(admin)/admin/evals"
```

- [ ] **Step 2: Move the three files**

```bash
git mv app/evals/page.tsx "app/(admin)/admin/evals/page.tsx"
git mv app/evals/loading.tsx "app/(admin)/admin/evals/loading.tsx"
git mv app/evals/page.test.tsx "app/(admin)/admin/evals/page.test.tsx"
```

- [ ] **Step 3: Remove the now-empty `app/evals/` directory**

```bash
rmdir app/evals
```

Expected: succeeds. If it errors with "Directory not empty", list the directory contents and figure out what else is there before continuing.

- [ ] **Step 4: Strip inline gate and outer padding from the moved page**

Replace the contents of `app/(admin)/admin/evals/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getEvalsDashboardWithLayout } from '@/lib/evals/queries'

import { EvalsDashboardV2 } from '@/components/evals/dashboard-v2/dashboard'

export const dynamic = 'force-dynamic'

export default async function EvalsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login')
    return null
  }

  const { data, layout: initialLayout } = await getEvalsDashboardWithLayout(
    user.id
  )

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 pb-8 pt-8 sm:px-6 lg:px-8">
        <EvalsDashboardV2 data={data} initialLayout={initialLayout} />
      </div>
    </div>
  )
}
```

Changes vs the old page:

- `isAdminUserId` import and non-admin `notFound()` check removed — the layout handles non-admin.
- Unauth `redirect('/auth/login')` retained as a defensive duplicate: the layout will catch it first, but keeping it here means the page is still safe if the layout is ever bypassed.
- Outer padding reduced from `pt-20` to `pt-8` — the chat `Header`'s absolute-positioned 80px top spacing is gone in the admin group.

- [ ] **Step 5: Adjust the loading skeleton's top padding**

Modify `app/(admin)/admin/evals/loading.tsx` line 8 (currently `pt-20`):

Change `pt-20` → `pt-8` to match the new page. Full line after edit:

```tsx
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-8 sm:px-6 lg:px-8">
```

- [ ] **Step 6: Trim the moved page test — layout owns auth**

Replace the contents of `app/(admin)/admin/evals/page.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockRedirect = vi.hoisted(() => vi.fn())
const mockGetCurrentUser = vi.hoisted(() => vi.fn())
const mockGetEvalsDashboardWithLayout = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: mockRedirect
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: mockGetCurrentUser
}))

vi.mock('@/lib/evals/queries', () => ({
  getEvalsDashboardWithLayout: mockGetEvalsDashboardWithLayout
}))

vi.mock('@/components/evals/dashboard-v2/dashboard', () => ({
  EvalsDashboardV2: ({
    data,
    initialLayout
  }: {
    data: unknown
    initialLayout: string
  }) => (
    <div data-testid="dashboard-v2" data-layout={initialLayout}>
      {JSON.stringify(data)}
    </div>
  )
}))

describe('/admin/evals page', () => {
  it('redirects logged-out users to /auth/login as a defensive fallback', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const { default: EvalsPage } = await import('./page')
    await EvalsPage()

    expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
  })

  it('loads dashboard data and layout preference and wires them to EvalsDashboardV2', async () => {
    const mockData = {
      capability: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      },
      trafficMonitor: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      }
    }
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mockGetEvalsDashboardWithLayout.mockResolvedValue({
      data: mockData,
      layout: 'b'
    })

    const { default: EvalsPage } = await import('./page')
    const result = await EvalsPage()
    render(result as React.ReactElement)

    expect(mockGetEvalsDashboardWithLayout).toHaveBeenCalledWith('admin-1')
    const dashboard = screen.getByTestId('dashboard-v2')
    expect(dashboard).toHaveAttribute('data-layout', 'b')
    expect(dashboard).toHaveTextContent(JSON.stringify(mockData))
  })
})
```

Dropped: the `hides the page from non-admin users` case — the layout test covers it. Kept: the redirect case because the page still has the defensive fallback.

- [ ] **Step 7: Run all tests**

Run: `bun run test`
Expected: all tests pass, including the moved `(admin)/admin/evals/page.test.tsx`, the new `(admin)/layout.test.tsx`, and the new `components/admin/admin-sidebar.test.tsx`.

- [ ] **Step 8: Typecheck + lint**

Run: `bun typecheck`
Run: `bun lint`
Expected: both pass.

- [ ] **Step 9: Smoke test `/admin/evals`**

Run: `bun dev`

As an admin user (check `ADMIN_USER_ID` matches your logged-in Supabase user id):

- Open `http://localhost:43100/admin/evals`. Expected: admin sidebar on the left (not chat sidebar), evals dashboard in the main area, no duplicate header.
- Open `http://localhost:43100/evals` (old URL). Expected: Next.js 404 (because the route no longer exists).
- Log out, then try `/admin/evals`. Expected: redirect to `/auth/login`.

Kill the dev server.

- [ ] **Step 10: Commit**

```bash
git add "app/(admin)/admin/evals"
git commit -m "refactor(admin): move evals page to /admin/evals under (admin) group"
```

(The `git rm` on the old locations is tracked by the `git mv`s in Step 2 — no separate add is needed.)

---

## Task 6: Update the user menu link

**Why this task:** The only in-app entry point to the admin surface lives in `UserMenu`. It still points at the old URL `/evals`, which now 404s.

**Files:**

- Modify: `components/user-menu.tsx:195`

### Steps

- [ ] **Step 1: Change the evals link target**

Modify `components/user-menu.tsx`. Find line 195 inside the `isAdmin` block:

```tsx
              <Link href="/evals">
```

Change to:

```tsx
              <Link href="/admin/evals">
```

- [ ] **Step 2: Typecheck + lint**

Run: `bun typecheck`
Run: `bun lint`
Expected: both pass.

- [ ] **Step 3: Smoke test the link**

Run: `bun dev`
Log in as admin, open `/`, open the user menu in the top right, click **Evals**. Expected: navigates to `/admin/evals` with admin chrome, no full page reload (URL changes via client navigation).

Kill the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/user-menu.tsx
git commit -m "fix(header): point admin evals link to new /admin/evals route"
```

---

## Task 7: Final verification

**Why this task:** Per `CLAUDE.md`: "Always run `bun lint` and `bun typecheck` before claiming done." This is the consolidated verification pass that blocks a premature "done" claim. A manual click-through ensures the UI actually works — test suites verify code correctness, not feature correctness.

**Files:** None modified; this is a checkpoint.

### Steps

- [ ] **Step 1: Full test suite**

Run: `bun run test`
Expected: zero failures. If any eval-adjacent test fails, re-check Task 5 — the most common cause is a stale import path.

- [ ] **Step 2: Full typecheck**

Run: `bun typecheck`
Expected: zero errors.

- [ ] **Step 3: Full lint**

Run: `bun lint`
Expected: zero errors **and** zero warnings. Fix every warning — do not dismiss as pre-existing.

- [ ] **Step 4: Production build**

Run: `bun run build`
Expected: build succeeds. Next.js will print the route table — confirm you see `/` (under `(chat)`), `/admin/evals` (under `(admin)`), `/auth/*`, `/api/*`. Confirm there is **no** `/evals` in the route table.

- [ ] **Step 5: Manual browser QA (the one that matters)**

Run: `bun dev`

Walk through these scenarios in one browser session:

1. **Logged out, `/`** — chat renders with sidebar. Click "Sign in" in sidebar footer.
2. **Logged out, `/auth/login`** — login form renders, **no** chat sidebar, **no** header.
3. **Logged out, `/admin/evals`** — redirects to `/auth/login`.
4. **Logged in as admin, `/`** — chat renders with chat sidebar. Open user menu → click **Evals** → lands on `/admin/evals` with admin sidebar + evals dashboard.
5. **Click "Back to chat"** in the admin sidebar → returns to `/` with chat sidebar.
6. **Logged in as admin, `/admin/feedback`** — admin sidebar renders, main area shows Next.js 404 (the placeholder nav items don't have pages yet). The admin sidebar itself renders the `Feedback` item with disabled styling — verify it doesn't actually navigate when clicked.
7. **Logged in as non-admin, `/admin/evals`** — 404 page renders (not a redirect, not a blank page).
8. **Logged in as admin, `/evals`** (old URL) — Next.js 404.
9. **Open the evals page**, confirm the dashboard loads data (requires the Supabase eval summaries table populated — if empty, empty state renders; both are acceptable).

Kill the dev server.

- [ ] **Step 6: Confirm the branch is in a shippable state**

Run: `git status`
Expected: working tree clean on top of the series of commits from Tasks 1–6.

Run: `git log --oneline main..HEAD`
Expected: 5 or 6 focused commits (one per task that touched files). Tasks 1, 2, 3, 4, 5, 6 each made a commit; Task 7 does not.

- [ ] **Step 7: Open the PR**

Follow the `requesting-code-review` skill to prepare review context, then open the PR with `gh pr create`. Title suggestion: `refactor(admin): extract admin surface into (admin) route group`. Body: summarize the three key changes (route groups introduced, admin sidebar added, evals URL moved to `/admin/evals`), link to the Pencil wireframe frame name, and include the manual QA checklist from Step 5 as the test plan.

---

## Self-Review (completed by plan author)

**1. Spec coverage:**

| Recommendation requirement                              | Task        |
| ------------------------------------------------------- | ----------- |
| Create `app/(chat)/layout.tsx` with chat chrome         | Task 1      |
| Slim `app/layout.tsx`                                   | Task 1      |
| Move chat routes into `(chat)/`                         | Tasks 1 & 2 |
| Delete obsolete `/auth` guards in sidebar + header      | Task 2      |
| Create `app/(admin)/layout.tsx` with one-time auth gate | Task 4      |
| Move `app/evals/*` to `app/(admin)/admin/evals/*`       | Task 5      |
| Update UserMenu link to `/admin/evals`                  | Task 6      |
| AdminSidebar: flat items, back-to-chat, ADMIN pill      | Task 3      |
| Verification                                            | Task 7      |

All spec items covered.

**2. Placeholder scan:** No TBDs, no "handle edge cases", no "similar to Task N". Every step has actual code or an exact shell command.

**3. Type consistency:** `AdminSidebar` is exported as a named export (`export function AdminSidebar`) and imported as a named import everywhere. `AdminLayout` is a default export. `EvalsPage` is a default export. `ADMIN_NAV_ITEMS`, `AdminNavItem` — used once in the component; no external callers. `getCurrentUser`, `isAdminUserId`, `getEvalsDashboardWithLayout`, `EvalsDashboardV2` names match the existing codebase.

**Known judgment call:** The admin header in Task 4 is intentionally minimal (no title bar inlined at this stage). The Pencil wireframe specifies a 56px top bar with page title + env pill — that is a **future task** and belongs in a follow-up PR, not this one. Surfacing this explicitly so the reviewer/implementer doesn't treat it as a scope regression: ship the chrome skeleton now, add the top bar and env pill in a separate commit or PR when the second admin page lands.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-16-admin-route-group.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
