# Generative UI Components

> **Audience:** Architect | Contributor
> **Prerequisites:** [Generative UI](GENERATIVE-UI.md)

This leaf summarizes the concrete display tool components rendered in chat.

## Display Tool Components

### Plan (`components/tool-ui/plan/`)

A visual step-by-step guide with status indicators and progress tracking.

**Props:** `id`, `title`, `description`, `todos[]` (each with `id`, `label`, `status`, optional `description`)

**Status types:** `pending` | `in_progress` | `completed` | `cancelled`

**Features:**

- Progress bar with percentage calculation
- Celebration animation when progress crosses thresholds
- Staggered entrance animations for new items
- Collapsible step descriptions
- Accordion for overflow items (shows first 4, collapses rest)
- `Plan.Compact` variant without header/progress bar

### DataTable (`components/tool-ui/data-table/`)

A sortable data table with rich column formatting and responsive layout.

**Props:** `id`, `columns[]` (key, label, format, sortable, align, `abbr`, `width`, `truncate`, `hideOnMobile`, `priority`), `data[]`, `rowIdKey`, `defaultSort`

**Format kinds:** `text`, `number`, `currency`, `percent`, `date`, `delta`, `boolean`, `link`, `badge`, `status`, `array`

**Features:**

- Three-state sort cycling (ascending -> descending -> unsorted)
- Container query responsive layout (`auto` switches between table and cards at `@md`)
- Mobile card view with accordion expand for secondary columns
- Column priority system (`primary`, `secondary`, `tertiary`) for mobile
- Accessibility: sort announcements, ARIA roles, keyboard navigation

**Compound components:** `DataTable`, `DataTable.Table` (forced table), `DataTable.Cards` (forced cards), `DataTable.Provider` (headless)

### Chart (`components/tool-ui/chart/`)

A data visualization component supporting bar and line charts via Recharts.

**Props:** `id`, `type` (bar/line), `title`, `description`, `data[]`, `xKey`, `series[]` (key, label, color), `colors[]`, `showLegend`, `showGrid`

**Features:**

- Bar and line chart types with automatic axis configuration
- Multiple data series with configurable color palette
- Individual series color overrides via `series[].color`
- Grid lines and legend support (configurable via `showGrid`, `showLegend`)
- Interactive tooltips via `ChartTooltip`
- Clickable data points with `onDataPointClick` callback (client-only prop)
- Card wrapper with optional title and description
- Schema validation with `superRefine` (rejects duplicate series keys, validates `xKey` and series keys exist in every data row, ensures Y-values are finite numbers or null)

### CitationList (`components/tool-ui/citation/`)

A list of source citations with metadata and navigation.

**Props:** `id`, `citations[]` (each with `id`, `href`, `title`, `snippet`, `domain`, `favicon`, `type`, `author`, `publishedAt`, `locale`)

**Citation types:** `webpage`, `document`, `article`, `api`, `code`, `other`

**Variants:**

- `default` — full cards with metadata, best for 3-6 sources where each needs visibility
- `inline` — compact badges that wrap in text flow, best for many inline references
- `stacked` — overlapping favicon circles with popover, best for compact source attribution

**Features:**

- Overflow indicator with popover for truncated lists
- Hover popover with delay for browsing
- Type-specific icons (Globe, FileText, Newspaper, etc.)
- Safe navigation href sanitization

### LinkPreview (`components/tool-ui/link-preview/`)

A rich link preview card with image, title, and description.

**Props:** `id`, `href`, `title`, `description`, `image`, `domain`, `favicon`, `createdAt`, `locale`, `ratio`, `fit`

**Features:**

- Aspect ratio options (16:9, 4:3, 1:1, auto)
- Image fit modes (cover, contain, fill)
- Hover scale animation on image
- Keyboard accessible (Enter/Space to navigate)
- Href sanitization for security

### AgentArtifact (`components/tool-ui/agent-artifact/`)

An inline artifact viewer for static generated code snippets, documents, tables, specs, or versioned artifact content that should remain in the chat instead of the canvas workspace.

**Props:** `id`, `title`, `artifactType`, `content`, `language`, `versions`, `currentVersion`, `metadata`

**Features:**

- Preview, code, and raw tabs
- Copy action and download-friendly content URL
- Optional version selection through `currentVersion`
- Metadata display for model, token count, size, and generation time

### Callout (`components/tool-ui/callout/`)

A styled callout box for highlighting critical information with variant-specific iconography and color.

**Props:** `id`, `variant`, `title` (optional), `content`

**Variants:** `info` | `warning` | `tip` | `success` | `error` | `definition`

**Features:**

- Variant-specific Lucide icons (Info, AlertTriangle, Lightbulb, CheckCircle2, XCircle, BookOpen)
- Color theming per variant with dark mode support
- Accessible `<aside role="note">` semantic HTML
- Concise — encourages 1-3 sentence content

### Timeline (`components/tool-ui/timeline/`)

A vertical chronological timeline of events with category-specific styling.

**Props:** `id`, `title`, `description` (optional), `events[]` (each with `id`, `date`, `title`, optional `description`, optional `category`)

**Event categories:** `milestone` | `event` | `release` | `announcement` | `default`

**Features:**

- Category-specific Lucide icons (Star, Calendar, Package, Megaphone, Flag)
- Color theming per category with dark mode support
- Connecting lines between events
- Date badges with category-colored backgrounds
- Accessible `<section>` + `<ol>` semantic HTML
- Schema validation with `superRefine` (rejects duplicate event IDs)

### OptionList (`components/tool-ui/option-list/`)

An interactive option list that pauses the AI conversation for user input.

**Props:** `id`, `options[]`, `selectionMode` (single/multi), `minSelections`, `maxSelections`, `actions[]`

**Features:**

- Single and multi-select modes with radio/checkbox indicators
- Full keyboard navigation (Arrow keys, Home/End, Enter/Space, Escape)
- ARIA listbox semantics
- Configurable action buttons (default: Clear + Confirm)
- **Receipt mode** — after selection, renders as a read-only confirmation card
- Max selection enforcement (locks unselected options when limit reached)

**Interactive flow:**

1. AI calls `displayOptionList` (no `execute` function)
2. Frontend renders interactive OptionList with a `submitInteractiveToolOutput` callback
3. User selects option(s) and clicks Confirm
4. The chat parent calls `addToolOutput({ tool, toolCallId, output: selection })`
5. AI continues with the user's selection
6. On reload, the component renders in receipt mode showing the confirmed selection

---
