import { assertChunkMapComplete, VENDOR_CHUNK_DEFS } from './chunk-defs'
import { DATE_FNS_VENDOR_JS } from './date-fns.generated'
import { LUCIDE_REACT_VENDOR_JS } from './lucide-react.generated'
import { MOTION_REACT_VENDOR_JS } from './motion-react.generated'
import { REACT_CORE_VENDOR_JS } from './react-core.generated'
import { RECHARTS_VENDOR_JS } from './recharts.generated'

type VendorChunk = {
  name: string
  js: string
  specifiers: string[]
}

/** Map chunk name → generated JS string */
const VENDOR_JS_MAP: Record<string, string> = {
  'react-core': REACT_CORE_VENDOR_JS,
  'lucide-react': LUCIDE_REACT_VENDOR_JS,
  recharts: RECHARTS_VENDOR_JS,
  'motion-react': MOTION_REACT_VENDOR_JS,
  'date-fns': DATE_FNS_VENDOR_JS
}

assertChunkMapComplete(
  VENDOR_JS_MAP,
  'VENDOR_JS_MAP',
  'lib/canvas/compiler/vendor/index.ts'
)

/**
 * Vendor chunks ordered by injection priority. react-core must come
 * first because add-on chunks reference its globals.
 */
const VENDOR_CHUNKS: VendorChunk[] = VENDOR_CHUNK_DEFS.map(def => ({
  name: def.name,
  js: VENDOR_JS_MAP[def.name],
  specifiers: def.specifiers
}))

const SPECIFIER_TO_CHUNK = new Map<string, string>()
for (const chunk of VENDOR_CHUNKS) {
  for (const spec of chunk.specifiers) {
    SPECIFIER_TO_CHUNK.set(spec, chunk.name)
  }
}

/**
 * Returns the vendor chunk name for a given import specifier, or
 * undefined if the specifier is not provided by any vendor chunk.
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
  selected.add('react-core')

  return VENDOR_CHUNKS.filter(c => selected.has(c.name))
    .map(c => c.js)
    .join('\n')
}
