import {
  ALLOWED_IMPORT_PATTERNS,
  BANNED_IMPORT_PATTERNS,
  isAllowedSourcePath,
  isTemplateOwnedFile,
  PREINSTALLED_PACKAGES
} from '../template-manifest'

import { normalizeImports } from './normalize-imports'

export interface ValidationError {
  code:
    | 'INVALID_SOURCE_PATH'
    | 'TEMPLATE_OWNED_FILE'
    | 'BANNED_IMPORT'
    | 'UNSUPPORTED_PACKAGE'
  message: string
  line?: number
  importPath?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  /** Whether any auto-repair was applied */
  repaired: boolean
  /** The content after normalization/repair (if repaired is true) */
  repairedContent?: string
}

/**
 * Extract import paths from source code.
 * Returns tuples of [lineNumber, importPath].
 */
function extractImportPaths(code: string): [number, string][] {
  const imports: [number, string][] = []
  const lines = code.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*import\s+.*?\s+from\s+['"]([^'"]+)['"]/)
    if (match) {
      imports.push([i + 1, match[1]])
    }
    // Also catch dynamic imports
    const dynamicMatch = lines[i].match(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/)
    if (dynamicMatch) {
      imports.push([i + 1, dynamicMatch[1]])
    }
  }

  return imports
}

/**
 * Check if an import path is allowed.
 */
function isAllowedImport(importPath: string): boolean {
  // Always-allowed patterns (react, relative, local aliases)
  if (ALLOWED_IMPORT_PATTERNS.some(p => p.test(importPath))) return true

  // Check against preinstalled packages
  // Handle sub-path imports like 'lucide-react/icons'
  const packageName = importPath.startsWith('@')
    ? importPath.split('/').slice(0, 2).join('/')
    : importPath.split('/')[0]

  return PREINSTALLED_PACKAGES.has(packageName)
}

/**
 * Check if an import path is explicitly banned.
 */
function isBannedImport(importPath: string): boolean {
  return BANNED_IMPORT_PATTERNS.some(p => p.test(importPath))
}

/**
 * Validate artifact source code and apply automatic repairs where possible.
 *
 * Checks:
 * 1. File path is not template-owned
 * 2. No banned imports (Next.js-specific)
 * 3. No unsupported package imports
 *
 * Auto-repairs:
 * - Shadcn-style imports rewritten to local @/components/ui/* paths
 * - Next.js link/image imports replaced with comments
 */
export function validateArtifactSource(input: {
  filePath: string
  content: string
}): ValidationResult {
  const errors: ValidationError[] = []

  // 1. Check if file is template-owned
  if (isTemplateOwnedFile(input.filePath)) {
    errors.push({
      code: 'TEMPLATE_OWNED_FILE',
      message: `Cannot modify template-owned file: ${input.filePath}`
    })
    return { valid: false, errors, repaired: false }
  }

  // 2. Check if file is within the allowed app source roots
  if (!isAllowedSourcePath(input.filePath)) {
    errors.push({
      code: 'INVALID_SOURCE_PATH',
      message: `Artifact files must live under src/: ${input.filePath}`
    })
    return { valid: false, errors, repaired: false }
  }

  // 3. Normalize imports (auto-repair shadcn and some Next.js imports)
  const normalized = normalizeImports(input.content)

  // 4. Validate imports in the normalized code
  const importPaths = extractImportPaths(normalized.code)

  for (const [line, importPath] of importPaths) {
    if (isBannedImport(importPath)) {
      errors.push({
        code: 'BANNED_IMPORT',
        message: `Import "${importPath}" is not available in a React SPA artifact`,
        line,
        importPath
      })
    } else if (!isAllowedImport(importPath)) {
      errors.push({
        code: 'UNSUPPORTED_PACKAGE',
        message: `Package "${importPath}" is not preinstalled in the artifact template`,
        line,
        importPath
      })
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, repaired: normalized.repaired }
  }

  return {
    valid: true,
    errors: [],
    repaired: normalized.repaired,
    ...(normalized.repaired ? { repairedContent: normalized.code } : {})
  }
}
