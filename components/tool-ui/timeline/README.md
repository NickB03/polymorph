# Timeline

Renders a vertical timeline of events with connector lines, category-colored dot markers, and date badges. Each event has a required `date`, `title`, and optional `description`. Supports five categories: `milestone`, `event`, `release`, `announcement`, and `default`.

## Files

- Public exports: `components/tool-ui/timeline/index.ts`
- Serializable schema + parse helpers: `components/tool-ui/timeline/schema.ts`

## Quick check

Run this after edits:

```bash
bun run test
```
