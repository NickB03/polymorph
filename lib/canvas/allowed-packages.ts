import { VENDOR_SPECIFIERS } from '@/lib/canvas/compiler/vendor/chunk-defs'

export type AllowedPackage = {
  specifier: string
  subpaths?: boolean
}

/**
 * Derived from VENDOR_CHUNK_DEFS (the single source of truth) plus
 * subpath rules that don't map to vendor chunks.
 */
export const CANVAS_ALLOWED_PACKAGES: AllowedPackage[] = [
  ...VENDOR_SPECIFIERS.filter(s => s !== 'date-fns').map(specifier => ({
    specifier
  })),
  // date-fns locale subpaths are allowed but resolved from the
  // filesystem (not vendored) — they need outputFileTracingIncludes
  // on Vercel until subpath vendoring is implemented.
  { specifier: 'date-fns', subpaths: true }
]

const exactSet = new Set(CANVAS_ALLOWED_PACKAGES.map(pkg => pkg.specifier))
const prefixEntries = CANVAS_ALLOWED_PACKAGES.filter(pkg => pkg.subpaths).map(
  pkg => `${pkg.specifier}/`
)

export function isAllowedCanvasImport(specifier: string): boolean {
  if (exactSet.has(specifier)) {
    return true
  }

  return prefixEntries.some(prefix => specifier.startsWith(prefix))
}

export const CANVAS_ALLOWED_PACKAGE_IMPORTS_LIST = CANVAS_ALLOWED_PACKAGES.map(
  pkg => pkg.specifier
)
