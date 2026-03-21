import { z } from 'zod'

import { CANVAS_ALLOWED_FILES } from '@/lib/canvas/constants'

const canvasAllowedFileSet = new Set<string>(CANVAS_ALLOWED_FILES)

export function normalizeCanvasFileKeys(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input
  }

  const files = input as Record<string, unknown>
  const normalized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(files)) {
    const quote = key[0]
    const isQuotedKey =
      key.length >= 2 &&
      (quote === "'" || quote === '"') &&
      key[key.length - 1] === quote

    if (isQuotedKey) {
      const unquotedKey = key.slice(1, -1)
      if (canvasAllowedFileSet.has(unquotedKey)) {
        normalized[unquotedKey] = value
        continue
      }
    }

    normalized[key] = value
  }

  return normalized
}

export const canvasFilesSchema = z.preprocess(
  normalizeCanvasFileKeys,
  z
    .object({
      'App.tsx': z.string(),
      'styles.css': z.string().optional(),
      'components.tsx': z.string().optional(),
      'meta.json': z.string().optional()
    })
    .strict()
)
