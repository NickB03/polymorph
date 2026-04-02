import { VENDOR_CHUNK_DEFS } from '@/lib/canvas/compiler/vendor/chunk-defs'

export type AllowedPackage = {
  specifier: string
  subpaths?: boolean
}

/**
 * Derived from VENDOR_CHUNK_DEFS (the single source of truth).
 * Chunks with `subpaths: true` get `subpaths` on their allowed entry.
 */
export const CANVAS_ALLOWED_PACKAGES: AllowedPackage[] =
  VENDOR_CHUNK_DEFS.flatMap(def =>
    def.specifiers.map(specifier => ({
      specifier,
      ...(def.subpaths && { subpaths: true })
    }))
  )

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
