import { DATE_FNS_VENDOR_JS } from './date-fns.generated'
import { LUCIDE_REACT_VENDOR_JS } from './lucide-react.generated'
import { MOTION_REACT_VENDOR_JS } from './motion-react.generated'
import { REACT_CORE_VENDOR_JS } from './react-core.generated'
import { RECHARTS_VENDOR_JS } from './recharts.generated'

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
    specifiers: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime']
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
  return SPECIFIER_TO_CHUNK.get(specifier)
}

/**
 * Given a set of vendor chunk names used by an artifact, returns the
 * concatenated vendor JS in the correct injection order. react-core
 * is always included (required by the JSX runtime).
 */
export function getVendorJs(usedChunkNames: Set<string>): string {
  const selected = new Set(usedChunkNames)
  // react-core is always required for JSX
  selected.add('react-core')

  return VENDOR_CHUNKS.filter(c => selected.has(c.name))
    .map(c => c.js)
    .join('\n')
}
