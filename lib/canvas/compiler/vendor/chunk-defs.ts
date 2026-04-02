/**
 * Single source of truth for canvas vendor chunk definitions.
 *
 * Both the build-time bundler (scripts/build-canvas-vendor.ts) and
 * the runtime registry (vendor/index.ts) derive their data from these
 * definitions. The allowed-packages list is also derived here.
 */

export type VendorChunkDef = {
  name: string
  /** Specifiers exposed to canvas artifact code via the runtime registry. */
  specifiers: string[]
  /**
   * Additional specifiers bundled into the IIFE but NOT exposed to
   * canvas code. Needed when other vendor chunks internally depend on
   * a specifier that canvas artifacts shouldn't import directly
   * (e.g., recharts imports bare 'react-dom').
   */
  bundleExtras?: string[]
  /**
   * Specifiers to shim to globalThis.__CANVAS_VENDOR__ at build time
   * so add-on chunks don't re-bundle React.
   */
  shimExternals?: string[]
  /** Additional global assignments (e.g., __CANVAS_REACT__ = React) */
  globalAliases?: Record<string, string>
  /**
   * When true, subpath imports (e.g., date-fns/locale/en-US) are
   * allowed but resolved from the filesystem rather than vendored.
   * Requires outputFileTracingIncludes on Vercel.
   */
  subpaths?: boolean
}

export const VENDOR_CHUNK_DEFS: VendorChunkDef[] = [
  {
    name: 'react-core',
    specifiers: ['react', 'react-dom/client', 'react/jsx-runtime'],
    // recharts imports bare 'react-dom' internally
    bundleExtras: ['react-dom'],
    globalAliases: {
      __CANVAS_REACT__: 'react',
      __CANVAS_REACT_DOM__: 'react-dom/client'
    }
  },
  {
    name: 'lucide-react',
    specifiers: ['lucide-react'],
    shimExternals: ['react', 'react/jsx-runtime']
  },
  {
    name: 'recharts',
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
    specifiers: ['motion/react'],
    shimExternals: ['react', 'react/jsx-runtime']
  },
  {
    name: 'date-fns',
    specifiers: ['date-fns'],
    subpaths: true
  }
]

/** All specifiers exposed to canvas artifact code. */
export const VENDOR_SPECIFIERS = VENDOR_CHUNK_DEFS.flatMap(c => c.specifiers)

/**
 * All specifiers bundled into IIFEs (exposed + internal extras).
 * Used by the build script to generate entry points.
 */
export function getAllBundleSpecifiers(def: VendorChunkDef): string[] {
  return [...def.specifiers, ...(def.bundleExtras ?? [])]
}

/**
 * CJS shim template used by both the build-time bundler and
 * the runtime compiler to redirect imports to the global vendor registry.
 */
export function vendorShimSource(specifier: string): string {
  return `module.exports = globalThis.__CANVAS_VENDOR__[${JSON.stringify(specifier)}]`
}

/**
 * Asserts that a name-keyed record has an entry for every vendor chunk.
 * Used by both the runtime registry and build script to catch missing entries
 * at module load / script start rather than at compile time.
 */
export function assertChunkMapComplete(
  map: Record<string, unknown>,
  mapName: string,
  filePath: string
): void {
  for (const def of VENDOR_CHUNK_DEFS) {
    if (!map[def.name]) {
      throw new Error(
        `${mapName} is missing entry for chunk "${def.name}". ` +
          `Add it to ${mapName} in ${filePath}.`
      )
    }
  }
}
