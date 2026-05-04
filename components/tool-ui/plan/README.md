# Plan

Renders a task plan card with a progress bar, todo items (`pending`, `in_progress`, `completed`, `cancelled`), staggered entrance animations, and collapsible overflow. Also exports a `Plan.Compact` variant without the header or progress bar.

## Files

- Public exports: `components/tool-ui/plan/index.tsx`
- Serializable schema + parse helpers: `components/tool-ui/plan/schema.ts`

## Quick check

Run this after edits:

```bash
bun run test
```
