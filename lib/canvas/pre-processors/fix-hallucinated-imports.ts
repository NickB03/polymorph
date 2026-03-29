import { CANVAS_ALLOWED_PACKAGE_IMPORTS } from '@/lib/canvas/constants'
import type { CanvasSourceFiles } from '@/lib/types/canvas'

const SINGLE_LINE_IMPORT_PATTERN =
  /^(\s*)import\s+(.+?)\s+from\s+(['"])([^'"]+)\3\s*;?\s*$/

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isSupportedSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    (CANVAS_ALLOWED_PACKAGE_IMPORTS as readonly string[]).includes(specifier)
  )
}

function extractNamedBindings(namedImports: string): string[] | null {
  const bindings = namedImports
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.replace(/^type\s+/, ''))
    .map(part => {
      if (part.includes(' as ')) {
        return part.split(/\s+as\s+/).at(-1) ?? null
      }

      return part
    })
    .filter((part): part is string => Boolean(part))

  return bindings.length > 0 ? bindings : null
}

function extractLocalBindings(importClause: string): string[] | null {
  const clause = importClause.trim()

  const namespaceOnlyMatch = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/)
  if (namespaceOnlyMatch) {
    return [namespaceOnlyMatch[1]]
  }

  if (clause.startsWith('{') && clause.endsWith('}')) {
    return extractNamedBindings(clause.slice(1, -1))
  }

  const mixedMatch = clause.match(
    /^([A-Za-z_$][\w$]*)\s*,\s*(\{[^}]+\}|\*\s+as\s+[A-Za-z_$][\w$]*)$/
  )
  if (mixedMatch) {
    const [, defaultBinding, remainder] = mixedMatch
    const remainderBindings = remainder.startsWith('{')
      ? extractNamedBindings(remainder.slice(1, -1))
      : (remainder.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/)?.slice(1) ?? null)

    if (!remainderBindings) {
      return null
    }

    return [defaultBinding, ...remainderBindings]
  }

  const defaultOnlyMatch = clause.match(/^([A-Za-z_$][\w$]*)$/)
  if (defaultOnlyMatch) {
    return [defaultOnlyMatch[1]]
  }

  return null
}

function stripUnusedUnsupportedImports(fileSource: string): string {
  const lines = fileSource.split('\n')

  // Build the non-import body once and strip comments/strings once for all
  // binding checks. This avoids O(n²) string reconstruction per import line.
  const nonImportBody = lines
    .filter(line => !SINGLE_LINE_IMPORT_PATTERN.test(line))
    .join('\n')
  const sanitizedBody = nonImportBody
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')

  return lines
    .map(line => {
      const match = line.match(SINGLE_LINE_IMPORT_PATTERN)
      if (!match) {
        return line
      }

      const [, , importClause, , specifier] = match
      if (isSupportedSpecifier(specifier)) {
        return line
      }

      const bindings = extractLocalBindings(importClause)
      if (!bindings) {
        return line
      }

      if (
        bindings.some(binding => {
          const pattern = new RegExp(`\\b${escapeRegExp(binding)}\\b`)
          return pattern.test(sanitizedBody)
        })
      ) {
        return line
      }

      return ''
    })
    .join('\n')
}

export function fixHallucinatedImports(
  source: CanvasSourceFiles
): CanvasSourceFiles {
  return Object.fromEntries(
    Object.entries(source).map(([fileName, fileSource]) => {
      if (!fileName.endsWith('.tsx')) {
        return [fileName, fileSource]
      }

      return [fileName, stripUnusedUnsupportedImports(fileSource)]
    })
  )
}
