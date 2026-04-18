# ESLint Conventions

## Rule policy

`eslint.config.mjs` inherits many rule levels from `eslint-config-next/core-web-vitals`.
`tests/eslint-config.test.ts` only guards repo-owned global rule changes, and requires a
justification in `eslint.config.mjs` when a local override downgrades an upstream rule to
`warn` or `off`.

If a rule is genuinely wrong for this codebase, disable it at the config level with an
inline explanation in `eslint.config.mjs` instead of sprinkling file-level disables across
the repo.

## Inline disables

Every `eslint-disable` comment must include a `-- <reason>` trailer:

```ts
// eslint-disable-next-line react-hooks/set-state-in-effect -- external-source sync (matchMedia subscription)
```

Bare directives fail `bun run test` via the guard in `tests/eslint-config.test.ts`.
The guard scans tracked `*.{js,jsx,ts,tsx,mjs,cjs}` files, including repo-owned config
files such as `eslint.config.mjs`.

## When to disable vs refactor

Prefer refactoring. Common fixes for the React Hooks v7 rules shipped with Next 16:

| Rule                  | Common refactor                                                               |
| --------------------- | ----------------------------------------------------------------------------- |
| `set-state-in-effect` | Derive during render or use `useSyncExternalStore` for external subscriptions |
| `exhaustive-deps`     | Inline the dependency or stabilize it with `useCallback` or `useMemo`         |
| `refs`                | Capture `ref.current` into a local at the top of the effect                   |
| `immutability`        | Replace mutation with an immutable copy                                       |

Disable only when the rule complaint is intentionally correct for the code.
