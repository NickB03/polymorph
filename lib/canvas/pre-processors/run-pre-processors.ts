import type { CanvasSourceFiles } from '@/lib/types/canvas'

import { fixHallucinatedImports } from './fix-hallucinated-imports'
import { fixMissingDefaultExport } from './fix-missing-default-export'
import { fixMissingLucideIcons } from './fix-missing-lucide-icons'

export function runPreProcessors(source: CanvasSourceFiles): CanvasSourceFiles {
  return [
    fixMissingDefaultExport,
    fixHallucinatedImports,
    fixMissingLucideIcons
  ].reduce((currentSource, preProcessor) => preProcessor(currentSource), source)
}
