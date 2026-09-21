import * as lucide from 'lucide-react'

import type { CanvasSourceFiles } from '@/lib/types/canvas'

// lucide-react 1.x removed brand icons (Instagram, Github, ...). The canvas
// vendor shim is CJS, so esbuild can't flag a missing named export: it becomes
// undefined at runtime, React throws #130, and the preview renders blank.
const FALLBACK_ICON = 'Globe'

const LUCIDE_IMPORT_PATTERN =
  /import\s*\{([^}]*)\}\s*from\s*(['"])lucide-react\2/g

function fixSpecifier(specifier: string): string {
  const trimmed = specifier.trim()
  if (!trimmed || trimmed.startsWith('type ')) return specifier

  const [imported, local = imported] = trimmed.split(/\s+as\s+/)
  if (imported in lucide) return specifier

  return specifier.replace(trimmed, `${FALLBACK_ICON} as ${local}`)
}

export function fixMissingLucideIcons(
  source: CanvasSourceFiles
): CanvasSourceFiles {
  return Object.fromEntries(
    Object.entries(source).map(([fileName, fileSource]) => {
      if (!fileName.endsWith('.tsx')) return [fileName, fileSource]

      return [
        fileName,
        fileSource.replace(LUCIDE_IMPORT_PATTERN, (match, specifiers: string) =>
          match.replace(
            specifiers,
            specifiers.split(',').map(fixSpecifier).join(',')
          )
        )
      ]
    })
  )
}
