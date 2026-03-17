import { SHADCN_IMPORT_PATTERNS } from '../template-manifest'

export interface NormalizeResult {
  code: string
  repaired: boolean
}

// Maps common component names to their ui file paths
const COMPONENT_FILE_MAP: Record<string, string> = {
  button: 'button',
  buttonvariants: 'button',
  card: 'card',
  cardheader: 'card',
  cardtitle: 'card',
  carddescription: 'card',
  cardcontent: 'card',
  cardfooter: 'card',
  input: 'input',
  label: 'label',
  badge: 'badge',
  avatar: 'avatar',
  dialog: 'dialog',
  dropdown: 'dropdown-menu',
  dropdownmenu: 'dropdown-menu',
  select: 'select',
  checkbox: 'checkbox',
  radio: 'radio-group',
  radiogroup: 'radio-group',
  switch: 'switch',
  slider: 'slider',
  tabs: 'tabs',
  toast: 'toast',
  toaster: 'toaster',
  tooltip: 'tooltip',
  popover: 'popover',
  separator: 'separator',
  skeleton: 'skeleton',
  textarea: 'textarea',
  table: 'table',
  sheet: 'sheet',
  accordion: 'accordion',
  alert: 'alert',
  alertdialog: 'alert-dialog',
  progress: 'progress',
  scroll: 'scroll-area',
  scrollarea: 'scroll-area',
  navigationmenu: 'navigation-menu',
  command: 'command',
  calendar: 'calendar',
  form: 'form',
  hover: 'hover-card',
  hovercard: 'hover-card'
}

/**
 * Extract the component file name from a shadcn-style import path.
 * e.g., 'shadcn/ui/button' -> 'button', 'shadcn/ui' -> infer from named imports
 */
function extractComponentFromPath(importPath: string): string | null {
  // e.g. shadcn/ui/button -> button
  const parts = importPath.split('/')
  const lastPart = parts[parts.length - 1]
  if (lastPart && lastPart !== 'ui') {
    return lastPart.toLowerCase()
  }
  return null
}

/**
 * Infer the component file name from named imports.
 * Uses the first named import to determine the target file.
 */
function inferComponentFromImports(importClause: string): string {
  // Extract names from destructured imports like { Button, Card }
  const match = importClause.match(/\{\s*([^}]+)\s*\}/)
  if (match) {
    const firstName = match[1].split(',')[0].trim().toLowerCase()
    return COMPONENT_FILE_MAP[firstName] || firstName
  }

  // Default import
  const defaultMatch = importClause.trim().split(/\s/)[0]?.toLowerCase()
  if (defaultMatch) {
    return COMPONENT_FILE_MAP[defaultMatch] || defaultMatch
  }

  return 'button' // fallback
}

/**
 * Check if an import path matches a shadcn-style pattern that can be auto-repaired.
 */
function isShadcnImport(importPath: string): boolean {
  return SHADCN_IMPORT_PATTERNS.some(p => p.test(importPath))
}

// Next.js imports that have safe browser-equivalent replacements.
// Only imports with known-safe replacements go here — others are left
// for the validator to reject as BANNED_IMPORT.
const NEXT_IMPORT_REPLACEMENTS: Record<string, string> = {
  'next/link': '// Replaced: Use <a> tags instead of Link',
  'next/image': '// Replaced: Use <img> tags instead of Image',
  'next/font': '// Replaced: Use standard CSS font imports instead'
}

/**
 * Normalize imports in artifact source code.
 *
 * - Rewrites shadcn package imports to local @/components/ui/* paths
 * - Replaces Next.js imports with browser-compatible comments
 * - Handles both single-line and multi-line destructured imports
 * - Leaves valid imports unchanged
 */
export function normalizeImports(code: string): NormalizeResult {
  let repaired = false
  const lines = code.split('\n')
  const outputLines: string[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Match single-line import statements
    const importMatch = line.match(
      /^(\s*import\s+)(.*?)\s+from\s+['"]([^'"]+)['"]/
    )

    if (importMatch) {
      const [, importKeyword, importClause, importPath] = importMatch

      // Handle shadcn-style imports
      if (isShadcnImport(importPath)) {
        const componentFromPath = extractComponentFromPath(importPath)
        const component =
          componentFromPath || inferComponentFromImports(importClause)
        outputLines.push(
          `${importKeyword}${importClause} from '@/components/ui/${component}'`
        )
        repaired = true
        i++
        continue
      }

      // Handle Next.js imports
      const nextReplacement = NEXT_IMPORT_REPLACEMENTS[importPath]
      if (nextReplacement) {
        outputLines.push(nextReplacement)
        repaired = true
        i++
        continue
      }

      // Non-replaceable next/* imports are left intact for the validator
      // to reject as BANNED_IMPORT with a structured error.
      outputLines.push(line)
      i++
      continue
    }

    // Multi-line import: import keyword + opening brace, no from clause
    if (
      /^\s*import\s/.test(line) &&
      /\{/.test(line) &&
      !/\bfrom\s+['"]/.test(line)
    ) {
      let found = false
      for (let j = i + 1; j < lines.length && j <= i + 30; j++) {
        const fromMatch = lines[j].match(/\}\s*from\s+['"]([^'"]+)['"]/)
        if (fromMatch) {
          const importPath = fromMatch[1]

          if (isShadcnImport(importPath)) {
            // Collapse multi-line import to single line with local path
            const importLines = lines.slice(i, j + 1)
            const fullImport = importLines.join(' ')
            const clauseMatch = fullImport.match(
              /^\s*import\s+([\s\S]*?)\s+from\s+/
            )
            const importClause = clauseMatch
              ? clauseMatch[1].replace(/\s+/g, ' ').trim()
              : ''
            const componentFromPath = extractComponentFromPath(importPath)
            const component =
              componentFromPath || inferComponentFromImports(importClause)
            outputLines.push(
              `import ${importClause} from '@/components/ui/${component}'`
            )
            repaired = true
          } else {
            const nextReplacement = NEXT_IMPORT_REPLACEMENTS[importPath]
            if (nextReplacement) {
              outputLines.push(nextReplacement)
              repaired = true
            } else {
              // Keep original multi-line import as-is
              for (let k = i; k <= j; k++) {
                outputLines.push(lines[k])
              }
            }
          }

          i = j + 1
          found = true
          break
        }
      }

      if (!found) {
        outputLines.push(line)
        i++
      }
      continue
    }

    // Non-import line, pass through
    outputLines.push(line)
    i++
  }

  return { code: outputLines.join('\n'), repaired }
}
