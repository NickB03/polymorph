import type { CanvasSourceFiles } from '@/lib/types/canvas'

import { fixHallucinatedImports } from './fix-hallucinated-imports'
import { fixMissingDefaultExport } from './fix-missing-default-export'

export function runPreProcessors(source: CanvasSourceFiles): CanvasSourceFiles {
  return [fixMissingDefaultExport, fixHallucinatedImports].reduce(
    (currentSource, preProcessor) => preProcessor(currentSource),
    { ...source }
  )
}
