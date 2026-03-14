/**
 * Template manifest defines the contract for the immutable React SPA template.
 *
 * Template-owned files cannot be edited by the model.
 * Only files within allowed source roots are editable.
 * Import validation uses the allowed/banned patterns to catch
 * common model mistakes before they hit the sandbox build.
 */

/** Files owned by the template that cannot be modified by artifact source updates */
export const TEMPLATE_OWNED_FILES = new Set([
  'package.json',
  'package-lock.json',
  'bun.lockb',
  'vite.config.ts',
  'tsconfig.json',
  'tailwind.config.js',
  'postcss.config.js',
  'index.html',
  'src/main.tsx',
  'src/index.css',
  'src/lib/utils.ts'
])

/** Patterns matching template-owned directories (any file under these is protected) */
export const TEMPLATE_OWNED_DIRS = ['src/components/ui/']

/** Directories where model-generated source files are allowed */
export const ALLOWED_SOURCE_ROOTS = ['src/']

/** Packages preinstalled in the template (available for import) */
export const PREINSTALLED_PACKAGES = new Set([
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'clsx',
  'tailwind-merge',
  'class-variance-authority',
  'lucide-react',
  'framer-motion',
  'sonner',
  'react-hook-form',
  'zod',
  'recharts',
  'date-fns',
  '@radix-ui/react-avatar',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-label',
  '@radix-ui/react-select',
  '@radix-ui/react-separator',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
  '@radix-ui/react-tooltip'
])

/** Import patterns that are always banned (Next.js-specific) */
export const BANNED_IMPORT_PATTERNS = [/^next\//, /^@next\//, /^next$/]

/** Import patterns that are always allowed */
export const ALLOWED_IMPORT_PATTERNS = [
  /^react($|\/)/,
  /^react-dom($|\/)/,
  /^@\//, // local alias imports
  /^\.\.?\// // relative imports
]

/** Import patterns that indicate a shadcn-style import needing normalization */
export const SHADCN_IMPORT_PATTERNS = [
  /^shadcn\/ui/,
  /^@shadcn\/ui/,
  /^@\/ui\//
]

/**
 * Check if a file path is template-owned and cannot be modified.
 */
export function isTemplateOwnedFile(filePath: string): boolean {
  // Normalize path (remove leading ./ or /)
  const normalized = filePath.replace(/^\.?\//, '')

  if (TEMPLATE_OWNED_FILES.has(normalized)) return true

  for (const dir of TEMPLATE_OWNED_DIRS) {
    if (normalized.startsWith(dir)) return true
  }

  return false
}

/**
 * Check if a file path is within an allowed source root.
 */
export function isAllowedSourcePath(filePath: string): boolean {
  const normalized = filePath.replace(/^\.?\//, '')
  return ALLOWED_SOURCE_ROOTS.some(root => normalized.startsWith(root))
}
