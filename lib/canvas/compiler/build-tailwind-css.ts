import fs from 'fs'
import path from 'path'
import { compile } from 'tailwindcss'

import type { CanvasSourceFiles } from '@/lib/types/canvas'

// Lazy-load the Tailwind CSS content on first use. We resolve the path
// directly from node_modules to avoid Turbopack's virtual module
// interception of require.resolve for serverExternalPackages.
let _tailwindCssCache: { path: string; base: string; content: string } | null =
  null

function getTailwindCss() {
  if (!_tailwindCssCache) {
    // Resolve the Tailwind CSS package directory directly from node_modules.
    // We cannot use require.resolve() here because tailwindcss is listed in
    // serverExternalPackages, and Turbopack intercepts require.resolve for
    // externals — returning a virtual path like "[externals]/tailwindcss
    // [external]..." that doesn't exist on the real filesystem.
    const pkgDir = path.resolve(process.cwd(), 'node_modules', 'tailwindcss')
    const cssPath = path.join(pkgDir, 'index.css')
    _tailwindCssCache = {
      path: cssPath,
      base: pkgDir,
      content: fs.readFileSync(cssPath, 'utf-8')
    }
  }
  return _tailwindCssCache
}

// ── Class extraction ────────────────────────────────────────────────

/**
 * Extract candidate class names from source files using a regex-based
 * scanner. This is intentionally simple and matches the approach
 * Tailwind uses internally for content scanning.
 */
function extractCandidates(source: CanvasSourceFiles): string[] {
  const candidates = new Set<string>()

  for (const [file, content] of Object.entries(source)) {
    // Only scan tsx/ts files for class names
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue

    // Match className="..." and className={'...'}
    // Also match template literals and string concatenations
    const classPatterns = [
      // className="word1 word2 ..."
      /className\s*=\s*"([^"]+)"/g,
      // className={'word1 word2 ...'}
      /className\s*=\s*\{\s*['"`]([^'"`]+)['"`]\s*\}/g,
      // className={`...`} template literals (static parts)
      /className\s*=\s*\{`([^`]+)`\}/g,
      // className={clsx('...')} or className={cn('...')} — extract string args
      /(?:clsx|cn|twMerge)\(\s*['"`]([^'"`]+)['"`]/g
    ]

    for (const pattern of classPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const classString = match[1]
        if (classString) {
          // Split by whitespace and add each class
          for (const cls of classString.split(/\s+/)) {
            const trimmed = cls.trim()
            if (trimmed && !trimmed.startsWith('${')) {
              candidates.add(trimmed)
            }
          }
        }
      }
    }
  }

  return [...candidates]
}

// ── Tailwind compilation ────────────────────────────────────────────

/**
 * Build Tailwind CSS from the canvas virtual file set.
 *
 * Uses Tailwind v4's `compile` API directly:
 * 1. Compile a synthetic CSS entry that imports Tailwind
 * 2. Extract candidate class names from source files
 * 3. Build CSS from candidates
 * 4. Merge with authored styles.css (authored CSS comes LAST so user rules win)
 */
export async function buildTailwindCss(
  source: CanvasSourceFiles
): Promise<string> {
  const candidates = extractCandidates(source)

  // Compile Tailwind v4 from a synthetic entry
  const compiled = await compile('@import "tailwindcss";', {
    // Tell the compiler not to auto-scan for sources by setting base to 'none'
    loadStylesheet: async () => {
      const tw = getTailwindCss()
      return { path: tw.path, base: tw.base, content: tw.content }
    }
  })

  // Build CSS from extracted candidates
  const tailwindCss = compiled.build(candidates)

  // Merge with authored styles.css (authored CSS last so user rules win)
  const authoredCss = source['styles.css'] ?? ''
  if (authoredCss.trim()) {
    return tailwindCss + '\n' + authoredCss
  }

  return tailwindCss
}
