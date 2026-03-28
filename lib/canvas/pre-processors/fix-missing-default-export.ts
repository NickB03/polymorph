import type { CanvasSourceFiles } from '@/lib/types/canvas'

const SUPPORTED_APP_DECLARATIONS = [
  /(?:^|\n)\s*(?:export\s+)?function\s+App\s*\(/,
  /(?:^|\n)\s*(?:export\s+)?const\s+App\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/
]

function countSupportedAppDeclarations(source: string): number {
  return SUPPORTED_APP_DECLARATIONS.reduce((count, pattern) => {
    return count + (pattern.test(source) ? 1 : 0)
  }, 0)
}

export function fixMissingDefaultExport(
  source: CanvasSourceFiles
): CanvasSourceFiles {
  if (!('App.tsx' in source)) {
    return source
  }

  const appSource = source['App.tsx']
  if (/\bexport\s+default\b/.test(appSource)) {
    return source
  }

  if (countSupportedAppDeclarations(appSource) !== 1) {
    return source
  }

  return {
    ...source,
    'App.tsx': `${appSource.trimEnd()}\n\nexport default App\n`
  }
}
