# Canvas Compiler Vendor Pre-Bundle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the canvas compiler's runtime dependency on `node_modules/` existing on disk by pre-bundling all allowed packages into vendor chunks at build time, injected into compiled HTML via globals.

**Architecture:** A build-time script bundles each canvas-allowed package group into a minified IIFE that assigns exports to `globalThis.__CANVAS_VENDOR__`. The compiler's virtual plugin resolves allowed imports to CJS shim modules (`module.exports = globalThis.__CANVAS_VENDOR__[key]`) instead of falling through to esbuild's filesystem resolver. `assembleCanvasHtml` injects only the vendor chunks the artifact actually uses before the user's IIFE.

**Tech Stack:** esbuild (build-time bundling + runtime compilation), TypeScript code generation, Vitest

---

## Problem

The canvas compiler runs esbuild at runtime in Vercel serverless functions. esbuild resolves allowed packages from `process.cwd()/node_modules/`, but those files don't exist on disk — Next.js bundled them into the function. This causes `Could not resolve "react/jsx-runtime"` and `Could not resolve "react-dom/client"`.

The `outputFileTracingIncludes` approach (copying raw package files to Vercel) works but is a deployment-layer hack that:

- Requires tracking 34+ transitive dependencies that change silently on upgrades
- Adds ~135 MB of raw files to every affected serverless function
- Couples the compiler's correctness to Vercel-specific configuration

The vendor pre-bundle eliminates the filesystem dependency entirely.

## Size Budget

The 2 MB compiled HTML limit (`CANVAS_MAX_COMPILED_HTML_SIZE` in `lib/canvas/constants.ts:15`) is the binding constraint. Measured vendor sizes (minified IIFE, esbuild, `platform: 'browser'`):

| Chunk                                          | Minified     | Notes                                             |
| ---------------------------------------------- | ------------ | ------------------------------------------------- |
| `react-core` (react + react-dom + jsx-runtime) | 190 KB       | Always included (JSX transform needs it)          |
| `lucide-react`                                 | 696 KB       | All 1500+ icons; only when imported               |
| `recharts` (+ d3 deps, redux)                  | 524 KB       | Only when imported                                |
| `motion-react` (+ framer-motion)               | 186 KB       | Only when imported                                |
| `date-fns`                                     | 74 KB        | Only when imported                                |
| **Monolithic total**                           | **1,653 KB** | 81% of limit — leaves ~400 KB for user code + CSS |

Per-package selective injection keeps simple artifacts small (~240 KB) while complex ones fit within budget.

## File Structure

| File                                                   | Action             | Responsibility                                                                                    |
| ------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------- |
| `scripts/build-canvas-vendor.ts`                       | Create             | Build-time script: bundles allowed packages into vendor IIFE chunks, writes generated `.ts` files |
| `lib/canvas/compiler/vendor/react-core.generated.ts`   | Create (generated) | Exports `REACT_CORE_VENDOR_JS` string constant (~190 KB)                                          |
| `lib/canvas/compiler/vendor/lucide-react.generated.ts` | Create (generated) | Exports `LUCIDE_REACT_VENDOR_JS` string constant                                                  |
| `lib/canvas/compiler/vendor/recharts.generated.ts`     | Create (generated) | Exports `RECHARTS_VENDOR_JS` string constant                                                      |
| `lib/canvas/compiler/vendor/motion-react.generated.ts` | Create (generated) | Exports `MOTION_REACT_VENDOR_JS` string constant                                                  |
| `lib/canvas/compiler/vendor/date-fns.generated.ts`     | Create (generated) | Exports `DATE_FNS_VENDOR_JS` string constant                                                      |
| `lib/canvas/compiler/vendor/index.ts`                  | Create             | Registry: maps package specifier → vendor chunk name + JS string                                  |
| `lib/canvas/compiler/compile-canvas-artifact.ts`       | Modify             | Virtual plugin: shim imports to vendor globals instead of `return undefined`                      |
| `lib/canvas/compiler/assemble-canvas-html.ts`          | Modify             | Inject selected vendor chunks before user IIFE                                                    |
| `lib/canvas/compiler/compile-canvas-artifact.test.ts`  | Modify             | Update existing tests for vendor architecture                                                     |
| `lib/canvas/compiler/vendor/vendor.test.ts`            | Create             | Tests for vendor build + shim resolution                                                          |
| `next.config.mjs`                                      | Modify             | Remove `outputFileTracingIncludes` (no longer needed)                                             |
| `package.json`                                         | Modify             | Add `build:canvas-vendor` script, update `vercel-build`                                           |
| `.gitattributes`                                       | Modify             | Mark `*.generated.ts` as linguist-generated                                                       |

## Context for Workers

- **Canvas compiler:** `lib/canvas/compiler/compile-canvas-artifact.ts`
  - Virtual plugin: lines 107-199
  - Entry source builder: lines 205-224 (sets `__CANVAS_REACT__`, `__CANVAS_REACT_DOM__`, `__CANVAS_APP__` globals)
  - esbuild config: lines 430-449 (`jsx: 'automatic'`, `jsxImportSource: 'react'`, `format: 'iife'`)
- **HTML assembly:** `lib/canvas/compiler/assemble-canvas-html.ts`
  - Bootstrap script reads from `__CANVAS_REACT__`, `__CANVAS_REACT_DOM__`, `__CANVAS_APP__` globals (lines 128-163)
  - Script injection order: `${assetScript}${js}${bootstrap}` (line 225)
- **Allowed packages:** `lib/canvas/allowed-packages.ts` — 7 specifiers. `date-fns` has `subpaths: true`
- **Turbopack caveat:** `require.resolve()` is intercepted for `serverExternalPackages` — returns virtual paths. Do NOT use it (documented in `build-tailwind-css.ts:16-19`)
- **IIFE + external limitation:** esbuild's IIFE format does not support `external` for bare specifiers. Use shim modules (CJS `module.exports`) instead.

---

### Task 1: Create the vendor build script

**Files:**

- Create: `scripts/build-canvas-vendor.ts`

This script builds each package group into a minified IIFE that registers exports on `globalThis.__CANVAS_VENDOR__`.

- [ ] **Step 1: Write the build script**

```typescript
/**
 * Builds per-package vendor chunks for the canvas compiler.
 * Each chunk is a minified IIFE that assigns package exports to
 * globalThis.__CANVAS_VENDOR__[specifier].
 *
 * Run: bun run build:canvas-vendor
 */
import * as esbuild from 'esbuild'
import * as fs from 'node:fs'
import * as path from 'node:path'

const VENDOR_DIR = path.resolve(__dirname, '../lib/canvas/compiler/vendor')

type VendorChunkDef = {
  /** Output file name (without .generated.ts) */
  name: string
  /** Exported constant name */
  exportName: string
  /** Package specifiers to include */
  specifiers: string[]
  /**
   * Specifiers to shim to globalThis.__CANVAS_VENDOR__ (for add-on
   * chunks that depend on react-core without re-bundling it).
   */
  shimExternals?: string[]
}

const VENDOR_CHUNKS: VendorChunkDef[] = [
  {
    name: 'react-core',
    exportName: 'REACT_CORE_VENDOR_JS',
    specifiers: ['react', 'react-dom/client', 'react/jsx-runtime']
  },
  {
    name: 'lucide-react',
    exportName: 'LUCIDE_REACT_VENDOR_JS',
    specifiers: ['lucide-react'],
    shimExternals: ['react', 'react/jsx-runtime']
  },
  {
    name: 'recharts',
    exportName: 'RECHARTS_VENDOR_JS',
    specifiers: ['recharts'],
    shimExternals: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime'
    ]
  },
  {
    name: 'motion-react',
    exportName: 'MOTION_REACT_VENDOR_JS',
    specifiers: ['motion/react'],
    shimExternals: ['react', 'react/jsx-runtime']
  },
  {
    name: 'date-fns',
    exportName: 'DATE_FNS_VENDOR_JS',
    specifiers: ['date-fns']
  }
]

function buildVendorEntry(specifiers: string[]): string {
  const lines: string[] = [
    'globalThis.__CANVAS_VENDOR__ = globalThis.__CANVAS_VENDOR__ || {};'
  ]
  for (const spec of specifiers) {
    const safe = spec.replace(/[^a-zA-Z0-9]/g, '_')
    lines.push(`import * as _${safe} from '${spec}';`)
    lines.push(
      `globalThis.__CANVAS_VENDOR__[${JSON.stringify(spec)}] = _${safe};`
    )
  }
  return lines.join('\n')
}

/**
 * Creates an esbuild plugin that shims specified packages to read from
 * globalThis.__CANVAS_VENDOR__ instead of bundling them. This prevents
 * add-on chunks from re-bundling React.
 */
function createShimPlugin(externals: string[]): esbuild.Plugin {
  const externalSet = new Set(externals)
  return {
    name: 'vendor-shim-externals',
    setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (externalSet.has(args.path)) {
          return { path: args.path, namespace: 'vendor-shim' }
        }
      })
      build.onLoad({ filter: /.*/, namespace: 'vendor-shim' }, args => ({
        contents: `module.exports = globalThis.__CANVAS_VENDOR__[${JSON.stringify(args.path)}]`,
        loader: 'js'
      }))
    }
  }
}

async function buildChunk(def: VendorChunkDef): Promise<void> {
  const entry = buildVendorEntry(def.specifiers)
  const plugins: esbuild.Plugin[] = []

  if (def.shimExternals?.length) {
    plugins.push(createShimPlugin(def.shimExternals))
  }

  const result = await esbuild.build({
    stdin: {
      contents: entry,
      loader: 'tsx',
      resolveDir: process.cwd()
    },
    bundle: true,
    write: false,
    format: 'iife',
    minify: true,
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    jsxImportSource: 'react',
    logLevel: 'silent',
    plugins
  })

  const js = result.outputFiles[0].text
  const sizeKB = (js.length / 1024).toFixed(0)

  const tsContent = [
    '// AUTO-GENERATED by scripts/build-canvas-vendor.ts',
    '// Do not edit manually. Regenerate with: bun run build:canvas-vendor',
    '',
    `export const ${def.exportName} = ${JSON.stringify(js)}`,
    ''
  ].join('\n')

  const outPath = path.join(VENDOR_DIR, `${def.name}.generated.ts`)
  fs.writeFileSync(outPath, tsContent, 'utf-8')
  console.log(
    `  ${def.name}: ${sizeKB} KB → ${path.relative(process.cwd(), outPath)}`
  )
}

async function main() {
  fs.mkdirSync(VENDOR_DIR, { recursive: true })

  console.log('Building canvas vendor chunks...')
  for (const def of VENDOR_CHUNKS) {
    await buildChunk(def)
  }
  console.log('Done.')
}

main().catch(err => {
  console.error('Failed to build canvas vendor chunks:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Create the vendor output directory**

Run: `mkdir -p lib/canvas/compiler/vendor`

- [ ] **Step 3: Run the build script**

Run: `bun run scripts/build-canvas-vendor.ts`
Expected: Prints sizes for each chunk and creates 5 `.generated.ts` files in `lib/canvas/compiler/vendor/`.

- [ ] **Step 4: Verify generated files exist and have content**

Run: `ls -lh lib/canvas/compiler/vendor/*.generated.ts`
Expected: 5 files, sizes roughly: react-core ~200 KB, lucide-react ~700 KB, recharts ~530 KB, motion-react ~190 KB, date-fns ~80 KB.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-canvas-vendor.ts lib/canvas/compiler/vendor/*.generated.ts
git commit -m "feat(canvas): add vendor chunk build script for canvas-allowed packages"
```

---

### Task 2: Create the vendor registry

**Files:**

- Create: `lib/canvas/compiler/vendor/index.ts`

This module maps package specifiers to their vendor chunk JS and provides a helper to select chunks for a given set of imports.

- [ ] **Step 1: Write the vendor registry**

```typescript
import { REACT_CORE_VENDOR_JS } from './react-core.generated'
import { LUCIDE_REACT_VENDOR_JS } from './lucide-react.generated'
import { RECHARTS_VENDOR_JS } from './recharts.generated'
import { MOTION_REACT_VENDOR_JS } from './motion-react.generated'
import { DATE_FNS_VENDOR_JS } from './date-fns.generated'

type VendorChunk = {
  /** Human-readable name */
  name: string
  /** Minified IIFE source */
  js: string
  /** Package specifiers this chunk provides */
  specifiers: string[]
}

/**
 * Vendor chunks ordered by injection priority. react-core must come
 * first because add-on chunks reference its globals.
 */
const VENDOR_CHUNKS: VendorChunk[] = [
  {
    name: 'react-core',
    js: REACT_CORE_VENDOR_JS,
    specifiers: ['react', 'react-dom/client', 'react/jsx-runtime']
  },
  {
    name: 'lucide-react',
    js: LUCIDE_REACT_VENDOR_JS,
    specifiers: ['lucide-react']
  },
  {
    name: 'recharts',
    js: RECHARTS_VENDOR_JS,
    specifiers: ['recharts']
  },
  {
    name: 'motion-react',
    js: MOTION_REACT_VENDOR_JS,
    specifiers: ['motion/react']
  },
  {
    name: 'date-fns',
    js: DATE_FNS_VENDOR_JS,
    specifiers: ['date-fns']
  }
]

/** Maps a bare specifier to the vendor chunk name that provides it. */
const SPECIFIER_TO_CHUNK = new Map<string, string>()
for (const chunk of VENDOR_CHUNKS) {
  for (const spec of chunk.specifiers) {
    SPECIFIER_TO_CHUNK.set(spec, chunk.name)
  }
}

/**
 * Returns the vendor chunk name for a given import specifier, or
 * undefined if the specifier is not provided by any vendor chunk.
 *
 * Handles date-fns subpath imports by mapping them to the date-fns chunk.
 */
export function getVendorChunkName(specifier: string): string | undefined {
  const direct = SPECIFIER_TO_CHUNK.get(specifier)
  if (direct) return direct

  // date-fns subpaths (e.g., date-fns/format) map to the date-fns chunk
  if (specifier.startsWith('date-fns/')) return 'date-fns'

  return undefined
}

/**
 * Given a set of vendor chunk names used by an artifact, returns the
 * concatenated vendor JS in the correct injection order. react-core
 * is always included (required by the JSX runtime).
 */
export function getVendorJs(usedChunkNames: Set<string>): string {
  // react-core is always required for JSX
  usedChunkNames.add('react-core')

  return VENDOR_CHUNKS.filter(c => usedChunkNames.has(c.name))
    .map(c => c.js)
    .join('\n')
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun typecheck`
Expected: Clean pass.

- [ ] **Step 3: Commit**

```bash
git add lib/canvas/compiler/vendor/index.ts
git commit -m "feat(canvas): add vendor chunk registry with selective injection"
```

---

### Task 3: Modify virtual plugin to use vendor shims

**Files:**

- Modify: `lib/canvas/compiler/compile-canvas-artifact.ts`

Replace the `return undefined` fallthrough for allowed imports with vendor shim resolution. Track which vendor chunks are used.

- [ ] **Step 1: Add vendor imports and shim namespace**

At the top of the file, add:

```typescript
import { getVendorChunkName } from './vendor'
```

Add a new constant after `VIRTUAL_NAMESPACE`:

```typescript
const VENDOR_SHIM_NAMESPACE = 'canvas-vendor-shim'
```

- [ ] **Step 2: Modify createVirtualPlugin to accept a used-chunks tracker**

Change the `createVirtualPlugin` function signature (line 107) to accept and populate a `usedVendorChunks` set:

```typescript
function createVirtualPlugin(
  source: CanvasSourceFiles,
  options: {
    artifactId?: string
    revisionId?: string
    debugEnabled?: boolean
    usedVendorChunks: Set<string>
  }
): esbuild.Plugin {
```

- [ ] **Step 3: Replace the fallthrough with vendor shim resolution**

In the `onResolve` handler for the virtual namespace (around line 153-166), replace:

```typescript
// Bare specifiers: allowed ones fall through to esbuild's native
// resolver (which uses resolveDir from onLoad); block everything else
if (isAllowedCanvasImport(args.path)) {
  return undefined
}
```

with:

```typescript
// Bare specifiers: resolve allowed ones to vendor shims
if (isAllowedCanvasImport(args.path)) {
  const chunkName = getVendorChunkName(args.path)
  if (chunkName) {
    options.usedVendorChunks.add(chunkName)
    return {
      path: args.path,
      namespace: VENDOR_SHIM_NAMESPACE
    }
  }
  // No vendor chunk (e.g., date-fns locale subpaths) — fall
  // through to esbuild's native filesystem resolver
  return undefined
}
```

- [ ] **Step 4: Add an onLoad handler for vendor shims**

Inside the `setup(build)` function, after the existing `onLoad` handler, add:

```typescript
// Load vendor shim modules — return CJS that reads from the
// global vendor registry. esbuild handles CJS→ESM interop for
// named imports like `import { useState } from 'react'`.
build.onLoad({ filter: /.*/, namespace: VENDOR_SHIM_NAMESPACE }, args => ({
  contents: `module.exports = globalThis.__CANVAS_VENDOR__[${JSON.stringify(args.path)}]`,
  loader: 'js'
}))
```

- [ ] **Step 5: Thread usedVendorChunks through the compile pipeline**

In `compileCanvasArtifactCore` (around line 440), create the set and pass it to the plugin:

```typescript
  const usedVendorChunks = new Set<string>()

  // ... in the esbuild.build() call:
  plugins: [
    createVirtualPlugin(source, {
      artifactId,
      revisionId,
      debugEnabled,
      usedVendorChunks
    })
  ],
```

After the esbuild step succeeds (after `bundledJs = jsOutput.text` around line 501), the `usedVendorChunks` set is populated. Pass it to `assembleCanvasHtml` (this will be wired in Task 5).

- [ ] **Step 6: Run existing tests to verify nothing is broken yet**

Run: `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`
Expected: Tests that import react/lucide/recharts/motion/date-fns still pass because the shims resolve to globals that are set by the vendor chunks (which will be injected in Task 5). However, tests that check the HTML output might need updating — check and note any failures.

- [ ] **Step 7: Commit**

```bash
git add lib/canvas/compiler/compile-canvas-artifact.ts
git commit -m "feat(canvas): replace filesystem fallthrough with vendor shim resolution"
```

---

### Task 4: Simplify the entry source

**Files:**

- Modify: `lib/canvas/compiler/compile-canvas-artifact.ts`

The entry source currently imports `react` and `react-dom/client` and assigns them to `__CANVAS_REACT__` / `__CANVAS_REACT_DOM__` globals. With vendor chunks, React is already on `__CANVAS_VENDOR__`. Move the global assignment to the vendor entry so the entry source only imports the user's `App.tsx`.

- [ ] **Step 1: Simplify buildEntrySource**

Replace the `buildEntrySource` function (lines 205-224) with:

```typescript
function buildEntrySource(source: CanvasSourceFiles): string {
  const lines = ["import * as __App from './App.tsx'"]

  if ('components.tsx' in source) {
    lines.push("import './components.tsx'")
  }

  lines.push('globalThis.__CANVAS_APP__ = __App;')

  return lines.join('\n')
}
```

- [ ] **Step 2: Update the vendor build script to set React globals**

In `scripts/build-canvas-vendor.ts`, update the `react-core` entry to also set the `__CANVAS_REACT__` and `__CANVAS_REACT_DOM__` globals that the bootstrap script reads. Change `buildVendorEntry` for react-core:

Add a `globalAliases` field to `VendorChunkDef`:

```typescript
type VendorChunkDef = {
  name: string
  exportName: string
  specifiers: string[]
  shimExternals?: string[]
  /** Additional global assignments (e.g., __CANVAS_REACT__ = React) */
  globalAliases?: Record<string, string>
}
```

Update the `react-core` definition:

```typescript
  {
    name: 'react-core',
    exportName: 'REACT_CORE_VENDOR_JS',
    specifiers: ['react', 'react-dom/client', 'react/jsx-runtime'],
    globalAliases: {
      '__CANVAS_REACT__': 'react',
      '__CANVAS_REACT_DOM__': 'react-dom/client'
    }
  },
```

Update `buildVendorEntry` to emit the aliases:

```typescript
function buildVendorEntry(def: VendorChunkDef): string {
  const lines: string[] = [
    'globalThis.__CANVAS_VENDOR__ = globalThis.__CANVAS_VENDOR__ || {};'
  ]
  for (const spec of def.specifiers) {
    const safe = spec.replace(/[^a-zA-Z0-9]/g, '_')
    lines.push(`import * as _${safe} from '${spec}';`)
    lines.push(
      `globalThis.__CANVAS_VENDOR__[${JSON.stringify(spec)}] = _${safe};`
    )
  }
  if (def.globalAliases) {
    for (const [globalName, specifier] of Object.entries(def.globalAliases)) {
      lines.push(
        `globalThis.${globalName} = globalThis.__CANVAS_VENDOR__[${JSON.stringify(specifier)}];`
      )
    }
  }
  return lines.join('\n')
}
```

- [ ] **Step 3: Regenerate vendor chunks**

Run: `bun run scripts/build-canvas-vendor.ts`
Expected: react-core chunk now includes `__CANVAS_REACT__` and `__CANVAS_REACT_DOM__` global assignments.

- [ ] **Step 4: Commit**

```bash
git add lib/canvas/compiler/compile-canvas-artifact.ts scripts/build-canvas-vendor.ts lib/canvas/compiler/vendor/*.generated.ts
git commit -m "refactor(canvas): simplify entry source — React globals come from vendor chunk"
```

---

### Task 5: Update HTML assembly to inject vendor chunks

**Files:**

- Modify: `lib/canvas/compiler/assemble-canvas-html.ts`
- Modify: `lib/canvas/compiler/compile-canvas-artifact.ts`

- [ ] **Step 1: Add vendorJs parameter to assembleCanvasHtml**

In `assemble-canvas-html.ts`, add `vendorJs` to the input type (around line 183):

```typescript
export type AssembleCanvasHtmlInput = {
  js: string
  css: string
  meta?: CanvasMetaJson
  artifactId?: string
  revisionId?: string
  nonce?: string
  vendorJs: string
}
```

- [ ] **Step 2: Inject vendor JS before user code**

In the `assembleCanvasHtml` function, update the script tag (around line 225) from:

```typescript
      <script>${assetScript}${js}${bootstrap}</script>
```

to:

```typescript
      <script>${vendorJs}${assetScript}${js}${bootstrap}</script>
```

The vendor chunk runs first, setting up `__CANVAS_VENDOR__` and `__CANVAS_REACT__`/`__CANVAS_REACT_DOM__`. Then the user's IIFE runs (reading from vendor globals via shims). Then the bootstrap mounts the app.

- [ ] **Step 3: Wire usedVendorChunks into the assembly call**

In `compile-canvas-artifact.ts`, import `getVendorJs`:

```typescript
import { getVendorChunkName, getVendorJs } from './vendor'
```

In `compileCanvasArtifactCore`, update the `assembleCanvasHtml` call (around line 604) to pass `vendorJs`:

```typescript
const vendorJs = getVendorJs(usedVendorChunks)

const html = assembleCanvasHtml({
  js: bundledJs,
  css,
  meta,
  artifactId,
  revisionId,
  nonce,
  vendorJs
})
```

- [ ] **Step 4: Run the full test suite**

Run: `bun run test -- lib/canvas/compiler/`
Expected: Most tests should pass. Tests that assert on HTML output or bundle size may need adjustment (vendor chunks add to the output). Note specific failures.

- [ ] **Step 5: Commit**

```bash
git add lib/canvas/compiler/assemble-canvas-html.ts lib/canvas/compiler/compile-canvas-artifact.ts
git commit -m "feat(canvas): inject vendor chunks into compiled HTML before user code"
```

---

### Task 6: Update tests

**Files:**

- Modify: `lib/canvas/compiler/compile-canvas-artifact.test.ts`
- Create: `lib/canvas/compiler/vendor/vendor.test.ts`

- [ ] **Step 1: Write vendor-specific tests**

```typescript
import { describe, expect, it } from 'vitest'

import { getVendorChunkName, getVendorJs } from './index'

describe('vendor registry', () => {
  it('maps react specifiers to react-core chunk', () => {
    expect(getVendorChunkName('react')).toBe('react-core')
    expect(getVendorChunkName('react-dom/client')).toBe('react-core')
    expect(getVendorChunkName('react/jsx-runtime')).toBe('react-core')
  })

  it('maps each optional package to its own chunk', () => {
    expect(getVendorChunkName('lucide-react')).toBe('lucide-react')
    expect(getVendorChunkName('recharts')).toBe('recharts')
    expect(getVendorChunkName('motion/react')).toBe('motion-react')
    expect(getVendorChunkName('date-fns')).toBe('date-fns')
  })

  it('maps date-fns subpaths to the date-fns chunk', () => {
    expect(getVendorChunkName('date-fns/format')).toBe('date-fns')
    expect(getVendorChunkName('date-fns/locale/en-US')).toBe('date-fns')
  })

  it('returns undefined for unknown specifiers', () => {
    expect(getVendorChunkName('lodash')).toBeUndefined()
    expect(getVendorChunkName('axios')).toBeUndefined()
  })

  it('always includes react-core in vendor JS output', () => {
    const js = getVendorJs(new Set())
    expect(js).toContain('__CANVAS_VENDOR__')
    expect(js).toContain('__CANVAS_REACT__')
  })

  it('includes only requested chunks plus react-core', () => {
    const js = getVendorJs(new Set(['recharts']))
    expect(js.length).toBeGreaterThan(0)
    // Should not include lucide-react or motion-react
    // (We can't easily check by content since it's minified,
    // but we can check that the size is less than the full monolithic)
    const fullJs = getVendorJs(
      new Set(['lucide-react', 'recharts', 'motion-react', 'date-fns'])
    )
    expect(js.length).toBeLessThan(fullJs.length)
  })

  it('vendor chunks contain valid JavaScript', () => {
    const js = getVendorJs(
      new Set(['lucide-react', 'recharts', 'motion-react', 'date-fns'])
    )
    // Should not throw when evaluated in a basic syntax check
    expect(() => new Function(js)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run vendor tests**

Run: `bun run test -- lib/canvas/compiler/vendor/vendor.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Fix compile-canvas-artifact tests**

The existing test `'bundles React and ReactDOM inline instead of loading from CDN'` checks that the output contains React code. With vendor chunks, React is in the vendor JS, not the user IIFE. Update the assertion to check the full HTML output (which includes vendor + user code).

The test `'A minimal app compiles to ~200 KB'` may need its size expectation updated since the vendor chunk is now separate from the user bundle. Update to check total HTML size is within the 2 MB limit.

Run: `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`

Fix any failing tests by updating assertions to account for the vendor chunk architecture. Key changes:

- Tests checking HTML content should still pass (vendor JS is in the HTML)
- Size tests may need updated thresholds
- Tests for specific imports (lucide, recharts, motion, date-fns) should still pass

- [ ] **Step 4: Run the full compiler test suite**

Run: `bun run test -- lib/canvas/compiler/`
Expected: All tests pass (32 existing + new vendor tests).

- [ ] **Step 5: Commit**

```bash
git add lib/canvas/compiler/vendor/vendor.test.ts lib/canvas/compiler/compile-canvas-artifact.test.ts
git commit -m "test(canvas): add vendor registry tests, update compiler tests for vendor architecture"
```

---

### Task 7: Clean up next.config.mjs and build pipeline

**Files:**

- Modify: `next.config.mjs`
- Modify: `package.json`
- Modify or create: `.gitattributes`

- [ ] **Step 1: Remove outputFileTracingIncludes from next.config.mjs**

Remove the `canvasRuntimePackages` import and `outputFileTracingIncludes` config entirely. The vendor chunks are imported as TypeScript constants and bundled into the serverless function by Next.js — no filesystem trace includes needed.

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['esbuild', 'tailwindcss'],
  images: {
    // ... rest unchanged
```

Note: if `date-fns/locale/*` subpath support is still needed via filesystem fallback, keep a minimal include for just `date-fns`:

```javascript
  outputFileTracingIncludes: {
    '/api/chat': ['./node_modules/date-fns/**/*'],
    '/api/canvas-artifacts/[artifactId]/draft': ['./node_modules/date-fns/**/*'],
    '/api/canvas-artifacts/[artifactId]/restore': ['./node_modules/date-fns/**/*']
  },
```

- [ ] **Step 2: Add build scripts to package.json**

Add to `"scripts"`:

```json
"build:canvas-vendor": "bun run scripts/build-canvas-vendor.ts"
```

Update `vercel-build`:

```json
"vercel-build": "bun run build:canvas-vendor && bun run migrate && next build"
```

- [ ] **Step 3: Mark generated files in gitattributes**

Add to `.gitattributes`:

```
lib/canvas/compiler/vendor/*.generated.ts linguist-generated=true
```

- [ ] **Step 4: Run lint, typecheck, and full test suite**

Run: `bun lint && bun typecheck && bun run test`
Expected: All clean.

- [ ] **Step 5: Commit**

```bash
git add next.config.mjs package.json .gitattributes
git commit -m "chore(canvas): remove outputFileTracingIncludes, add vendor build to pipeline"
```

---

### Task 8: Full verification

- [ ] **Step 1: Clean rebuild**

Run: `bun run build:canvas-vendor && bun run build`
Expected: Build completes successfully.

- [ ] **Step 2: Verify no outputFileTracingIncludes references remain (except date-fns if kept)**

Run: `grep -r 'outputFileTracingIncludes' next.config.mjs`
Expected: Either absent entirely, or only the minimal `date-fns` entry.

- [ ] **Step 3: Verify vendor chunks are bundled into the serverless function**

Run: `grep -l '__CANVAS_VENDOR__' .next/server/app/api/chat/route.js 2>/dev/null || grep -rl '__CANVAS_VENDOR__' .next/server/ 2>/dev/null | head -3`
Expected: The chat route's compiled JS contains `__CANVAS_VENDOR__`, confirming the vendor strings are bundled in.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(canvas): vendor pre-bundle for Vercel canvas compilation

Canvas artifacts failed on Vercel with 'Could not resolve react/jsx-runtime'
because esbuild resolves packages from disk at runtime, but they don't exist
in the serverless function.

Instead of copying 34+ transitive deps to disk via outputFileTracingIncludes,
this pre-bundles all canvas-allowed packages into vendor IIFE chunks at build
time. The compiler's virtual plugin shims allowed imports to read from
globalThis.__CANVAS_VENDOR__ instead of the filesystem. Per-package selective
injection keeps simple artifacts small (~240 KB) while complex ones (~1.7 MB)
fit within the 2 MB HTML limit.

Vendor chunks are generated TypeScript constants imported by the compiler,
so they're bundled into the serverless function by Next.js — no filesystem
access needed at runtime."
```

---

## date-fns locale subpaths

The vendor chunk bundles `date-fns` top-level (all functions). Subpath imports like `import { format } from 'date-fns/format'` work because the shim returns the full module and esbuild resolves named exports.

However, `import { enUS } from 'date-fns/locale/en-US'` exports a locale object not available from the top-level module. Two options:

1. **Keep a minimal `outputFileTracingIncludes`** for just `date-fns` (no transitive deps — it has none). This is the approach documented in Task 7.
2. **Drop locale subpath support.** Modern `date-fns` supports `locale` options passed as function arguments rather than separate imports. This is a minor breaking change for existing artifacts.

Choose option 1 unless locale subpath usage is confirmed to be zero.
