# Polymorph Design System

This file is the design-system source for Open CoDesign and other design agents working in Polymorph. Treat it as project context, not as a replacement for the live code. Refresh against the source files listed at the end before making broad UI changes.

## Product Identity

Polymorph is an AI workspace for research, creation, and exploration. The interface should feel quiet, capable, and immediate: a conversation-first surface that can expand into research activity, tools, generated UI, and a canvas workspace without turning into a marketing page.

The product voice is concise and practical. Prefer short verbs and direct labels: `Search`, `Research`, `Build`, `New chat`, `Open in Phoenix`. Avoid ornamental copy, novelty labels, or explanatory chrome that slows repeated use.

## Design Principles

1. Conversation is the primary surface. Keep empty states welcoming, but once a chat starts, prioritize reading, streaming state, citations, tool output, and the composer.
2. Useful density over decoration. Dashboards, evals, tool cards, and side panels should be compact, scan-friendly, and stable under live updates.
3. Mode color has meaning. Blue means research, amber means build/canvas generation, violet is an occasional assistive/tip accent, and neutral gray is default search/chat.
4. Generated artifacts belong beside the chat, not above it. Canvas and activity panels are supporting workspaces that expand from the conversation.
5. Motion should clarify state changes. Use small entrances, fades, morphing wordmark motion, and progress transitions. Respect reduced-motion preferences.
6. UI must survive long sessions. Avoid layout shifts, hidden state leakage between chats, oversized panels, and text that cannot wrap.

## Core Tokens

The live token source is `app/globals.css`. Use CSS variables and Tailwind v4 theme tokens rather than hard-coded colors.

### Neutral Palette

| Token                | Light             | Dark              | Use                                    |
| -------------------- | ----------------- | ----------------- | -------------------------------------- |
| `--background`       | `oklch(0.99 0 0)` | `oklch(0 0 0)`    | App shell and chat background          |
| `--foreground`       | `oklch(0 0 0)`    | `oklch(1 0 0)`    | Primary text and icons                 |
| `--card`             | `oklch(1 0 0)`    | `oklch(0.14 0 0)` | Cards, tool UI containers              |
| `--muted`            | `oklch(0.97 0 0)` | `oklch(0.23 0 0)` | Composer fill, skeletons, quiet panels |
| `--muted-foreground` | `oklch(0.44 0 0)` | `oklch(0.72 0 0)` | Secondary labels, helper text          |
| `--border`           | `oklch(0.92 0 0)` | `oklch(0.26 0 0)` | Hairlines, cards, separators           |
| `--input`            | `oklch(0.94 0 0)` | `oklch(0.32 0 0)` | Inputs, composer border                |

### Accent Palette

| Token                  | Light                    | Dark                     | Use                                                         |
| ---------------------- | ------------------------ | ------------------------ | ----------------------------------------------------------- |
| `--accent-blue`        | `oklch(0.546 0.245 263)` | `oklch(0.707 0.165 255)` | Polymorph wordmark suffix, Research mode, focus ring family |
| `--accent-blue-hover`  | `oklch(0.488 0.243 264)` | `oklch(0.64 0.17 256)`   | Blue hover states                                           |
| `--accent-blue-subtle` | `oklch(0.95 0.02 263)`   | `oklch(0.22 0.03 263)`   | Research pills, subtle blue backgrounds                     |
| `--accent-violet`      | `oklch(0.61 0.21 293)`   | `oklch(0.71 0.19 293)`   | Tip/assistive accent                                        |
| `--accent-amber`       | `oklch(0.72 0.17 70)`    | `oklch(0.8 0.15 70)`     | Build mode, artifact-generation affordances                 |
| `--destructive`        | `oklch(0.63 0.19 23.03)` | `oklch(0.69 0.2 23.91)`  | Destructive and error states                                |

Semantic aliases exist for tool callouts and status surfaces: `--info`, `--success`, `--warning`, `--error`, `--tip` plus matching `*-bg` and `*-border` tokens. Use those aliases for status UI instead of inventing one-off colors.

### Typography

`app/globals.css` declares `--font-sans: var(--font-geist-sans), sans-serif`, `--font-serif: Georgia, serif`, and `--font-mono: var(--font-geist-mono), monospace`. The Geist Sans and Mono webfonts are loaded via the `geist` package's `next/font` exports in `app/layout.tsx` and applied to the body; globals.css then aliases the package's variable names to the Tailwind-friendly `--font-sans` / `--font-mono` tokens used throughout the app.

- Default interface text: `font-sans`, neutral, direct, medium weight for controls.
- Product wordmark: text-based `poly` + animated blue suffix. Do not replace it with an unrelated logo mark.
- Numeric dashboards: use `tabular-nums` for scores, pass rates, sample counts, and deltas.
- Headings inside app surfaces: compact and functional. Typical admin/dashboard page heading is `text-2xl font-semibold`; card titles are often `text-base` or `text-sm`.
- Chat and markdown content: keep prose readable, avoid cramped line height, and preserve citation/link affordances.

### Shape, Spacing, Shadow

- Base radius is `--radius: 0.5rem`.
- Default buttons are `rounded-md`; icon and mode controls often become `rounded-full`.
- Composer shell uses `rounded-3xl` with muted fill and input border.
- Cards use `rounded-lg border bg-card shadow-xs`; tool UI and thumbnails often use `rounded-xl`.
- Touch and click targets should be at least `h-11` or `size-11` for primary controls.
- Shadows are subtle. Prefer border and surface contrast first; use `shadow-xs`, `shadow-md`, or focused rings sparingly.

## Layout System

### App Shell

The main chat route uses a left sidebar, absolute header, central chat column, and optional right panel.

- Sidebar: persistent on desktop, off-canvas on mobile; contains the `pm` mark, new chat, history, and guest sign-in nudge.
- Header: lightweight top-right actions with backdrop blur on small screens.
- Chat region: centered with `md:max-w-4xl`, generous side padding, and no decorative wrapper around the entire conversation.
- Right panel: canvas/activity/inspector appears as an independent resizable panel on desktop and a full-screen overlay on mobile.

### Empty Chat

The empty chat state should be calm and direct:

- Center the animated Polymorph wordmark above the composer.
- Put the composer in the visual center without adding a hero section.
- Show pill-like prompt categories and build-template cards below the composer.
- Avoid broad marketing copy, feature tours, or card grids that compete with the input.

### Active Chat

Once messages exist:

- Composer becomes sticky at the bottom with safe-area padding.
- Message content is the reading spine; tool output appears inline only when it helps the answer.
- Loading alternates between skeleton text and the animated three-dot logo.
- Keep citations visible in normal chat and move selected research-only citations to the activity panel when the code path does so.

### Canvas Workspace

Canvas is one artifact per chat. Keep it coupled to chat context:

- Desktop: resizable right workspace, default around 500px, bounded between 320px and 800px while preserving a 360px chat minimum.
- Mobile: workspace overlays chat full-screen while chat remains mounted behind it.
- Split view: pair the CodeMirror editor with live preview, diagnostics, and version history without unmounting chat behind the mobile overlay.
- Use amber build-mode accents for artifact-generation affordances.
- Runtime errors, compile progress, and diagnostics should feel operational and clear, not like modal interruptions.

## Component Guidance

### Buttons And Controls

Use the local shadcn/Radix primitives in `components/ui`. Default button variants are `default`, `destructive`, `outline`, `secondary`, `ghost`, and `link`; sizes are `default`, `sm`, `lg`, and `icon`.

- Use lucide icons for action buttons.
- Use icon-only buttons for common actions where a standard icon exists.
- Preserve visible focus rings with `focus-visible:ring-2 focus-visible:ring-ring`.
- Do not create bespoke button colors unless they map to mode or semantic tokens.

### Composer

The composer is the app's main input surface:

- Muted rounded container, transparent textarea, 14px to 16px text.
- Bottom action row: upload, mode selector, optional voice toggle, send/stop button.
- Active mode pill communicates state with border, tinted background, icon, label, and clear action.
- Keep upload and voice controls aligned with the same target size as send.

### Tool UI

Tool cards should feel embedded in the conversation, not like separate dashboards.

- Use `rounded-lg`/`rounded-xl`, border, `bg-card` or semantic subtle backgrounds.
- Use `ToolCardMount`/motion mount patterns when adding a registered tool UI.
- Show unavailable output as dashed bordered fallback only when there is no renderer.
- Use semantic callout tokens for `info`, `warning`, `tip`, `success`, `error`, and `definition`.
- Data-heavy tools can use cards, tables, charts, and timelines, but keep labels compact and avoid decorative space.

### Evals And Admin Dashboards

Admin surfaces are operational:

- Use `max-w-7xl`, `grid-cols-12`, compact cards, and tabular numeric metrics.
- KPI tiles should prioritize label, value, health state, delta, and trend.
- Use status badges, sparklines, and borders to show state without visual noise.
- Empty states can be dashed and muted; never pretend missing run data is healthy.

### Build Templates

Build starter cards use real thumbnails from `public/images/build-templates/*.svg`.

- Keep the grid compact; current empty-chat build view uses three columns.
- Thumbnails use `aspect-[3/2]`, `rounded-xl`, `overflow-hidden`, `bg-muted/50`, and a light border ring.
- Labels are quiet until hover.

## Motion

Motion sources are `app/globals.css` and `lib/motion/tokens.ts`.

- Standard entrance: `animate-content-enter`, 0.4s, slight upward movement.
- Tool/plan micro-motion: fade, small slide, small zoom, staggered delays.
- Wordmark suffix morphs through `morph`, `explore`, `create`, `discover`, `research`, then lands on `morph`.
- Loading indicator uses three staggered dots.
- Global reduced-motion handling shortens animations and transitions. New motion must remain meaningful with animations disabled.

## Accessibility And Responsiveness

- Preserve semantic landmarks and roles in chat and dashboards.
- Keep button targets at least 44px where possible.
- Do not hide focus outlines.
- Text must wrap inside cards, pills, and tool UI. Use `min-w-0`, `break-words`, `truncate`, or `line-clamp` intentionally.
- Respect `env(safe-area-inset-bottom)` around sticky mobile composer controls.
- Avoid one-off viewport scaling that causes hydration or mobile overlap issues.

## Do Not Do

- Do not introduce a decorative landing page for the app shell.
- Do not replace the neutral system with a broad purple/blue gradient theme.
- Do not add stock photos, blob/orb backgrounds, or illustrative filler around chat.
- Do not introduce new UI libraries or alternate design systems for Tool UI.
- Do not hard-code colors when CSS variables exist.
- Do not use dense nested cards inside cards; frame individual repeated items only.
- Do not let generated artifact styling leak into app chrome unless the user explicitly asks.

## Source Files To Refresh

- `app/globals.css`
- `app/layout.tsx`
- `app/(chat)/layout.tsx`
- `components/chat.tsx`
- `components/chat-panel.tsx`
- `components/chat-messages.tsx`
- `components/header.tsx`
- `components/app-sidebar.tsx`
- `components/mode-selector.tsx`
- `components/polymorph-wordmark.tsx`
- `components/canvas/chat-canvas-shell.tsx`
- `components/tool-ui/registry.tsx`
- `components/tool-ui/*`
- `components/evals/dashboard-v2/*`
- `components/evals/dashboard/*`
- `components/evals/glossary/*`
- `components/ui/*`
- `lib/config/search-modes.ts`
- `lib/motion/tokens.ts`
