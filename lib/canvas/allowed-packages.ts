export type AllowedPackage = {
  specifier: string
  subpaths?: boolean
}

export const CANVAS_ALLOWED_PACKAGES: AllowedPackage[] = [
  { specifier: 'react' },
  { specifier: 'react-dom/client' },
  { specifier: 'react/jsx-runtime' },
  { specifier: 'lucide-react' },
  { specifier: 'recharts' },
  { specifier: 'motion/react' },
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
