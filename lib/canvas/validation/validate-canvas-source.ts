import { z } from 'zod'

import {
  CANVAS_ALLOWED_FILES,
  CANVAS_ALLOWED_PACKAGE_IMPORTS,
  CANVAS_MAX_ASSET_PAYLOAD_SIZE,
  CANVAS_MAX_FILE_SIZE,
  CANVAS_MAX_TOTAL_SOURCE_SIZE,
  CANVAS_REQUIRED_FILES
} from '@/lib/canvas/constants'
import type {
  CanvasDiagnostic,
  CanvasExternalDependency,
  CanvasSourceFiles
} from '@/lib/types/canvas'

// ── meta.json zod schema ────────────────────────────────────────────

const metaJsonAssetSchema = z.object({
  mimeType: z.string(),
  data: z.string()
})

const externalDependencySchema = z.object({
  type: z.enum(['image', 'font', 'media', 'api']),
  url: z.string(),
  label: z.string().optional()
})

const metaJsonSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    viewport: z.string().optional(),
    assets: z.record(z.string(), metaJsonAssetSchema).optional(),
    externalDependencies: z.array(externalDependencySchema).optional()
  })
  .strict()

// ── Import scanning ─────────────────────────────────────────────────

const NODE_APIS = new Set([
  'fs',
  'path',
  'os',
  'child_process',
  'cluster',
  'crypto',
  'dgram',
  'dns',
  'events',
  'http',
  'http2',
  'https',
  'net',
  'readline',
  'stream',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'worker_threads',
  'zlib',
  'assert',
  'buffer',
  'console',
  'constants',
  'domain',
  'module',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'string_decoder',
  'timers',
  'trace_events',
  'wasi'
])

const IMPORT_PATTERN =
  /(?:import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g

const FRAMEWORK_PREFIXES = ['next/', 'next', '@remix-run/']

function classifyImport(
  specifier: string,
  file: string,
  line: number
): CanvasDiagnostic | null {
  // Allow relative imports
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return null
  }

  // Allow explicitly allowed packages
  const allowedPackages = CANVAS_ALLOWED_PACKAGE_IMPORTS as readonly string[]
  if (allowedPackages.includes(specifier)) {
    return null
  }

  // Reject remote ESM/CDN imports
  if (specifier.startsWith('https://') || specifier.startsWith('http://')) {
    return {
      severity: 'error',
      message: `Import '${specifier}' — remote ESM or CDN imports are not allowed`,
      file,
      line
    }
  }

  // Reject node: prefixed imports
  if (specifier.startsWith('node:')) {
    return {
      severity: 'error',
      message: `Import '${specifier}' — Node.js APIs are not allowed`,
      file,
      line
    }
  }

  // Reject Node.js API imports
  const baseModule = specifier.split('/')[0]
  if (NODE_APIS.has(baseModule)) {
    return {
      severity: 'error',
      message: `Import '${specifier}' — Node.js APIs are not allowed`,
      file,
      line
    }
  }

  // Reject server-only framework APIs
  for (const prefix of FRAMEWORK_PREFIXES) {
    if (specifier === prefix || specifier.startsWith(prefix)) {
      return {
        severity: 'error',
        message: `Import '${specifier}' — server-only framework APIs are not allowed`,
        file,
        line
      }
    }
  }

  // Everything else is an arbitrary npm package
  return {
    severity: 'error',
    message: `Import '${specifier}' — arbitrary npm packages are not allowed`,
    file,
    line
  }
}

function scanImports(content: string, file: string): CanvasDiagnostic[] {
  const diagnostics: CanvasDiagnostic[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const lineContent = lines[i]
    // Reset the regex for each line
    IMPORT_PATTERN.lastIndex = 0
    let match
    while ((match = IMPORT_PATTERN.exec(lineContent)) !== null) {
      const specifier = match[1] ?? match[2] ?? match[3]
      if (specifier) {
        const diag = classifyImport(specifier, file, i + 1)
        if (diag) diagnostics.push(diag)
      }
    }
  }

  return diagnostics
}

// ── Remote injection scanning ───────────────────────────────────────

const REMOTE_SCRIPT_PATTERN =
  /<script\s[^>]*src\s*=\s*['"]https?:\/\/[^'"]+['"]/gi

const REMOTE_STYLESHEET_PATTERN =
  /<link\s[^>]*rel\s*=\s*['"]stylesheet['"][^>]*href\s*=\s*['"]https?:\/\/[^'"]+['"]/gi

function scanRemoteInjection(
  content: string,
  file: string
): CanvasDiagnostic[] {
  const diagnostics: CanvasDiagnostic[] = []

  if (REMOTE_SCRIPT_PATTERN.test(content)) {
    diagnostics.push({
      severity: 'error',
      message:
        'remote <script> tags are not allowed — all code must be part of the virtual file set',
      file
    })
  }
  REMOTE_SCRIPT_PATTERN.lastIndex = 0

  if (REMOTE_STYLESHEET_PATTERN.test(content)) {
    diagnostics.push({
      severity: 'error',
      message:
        'remote stylesheet injection is not allowed — use styles.css for custom styles',
      file
    })
  }
  REMOTE_STYLESHEET_PATTERN.lastIndex = 0

  return diagnostics
}

// ── Main validator ──────────────────────────────────────────────────

export type ValidationResult = {
  ok: boolean
  files: string[]
  diagnostics: CanvasDiagnostic[]
  externalDependencies: CanvasExternalDependency[]
}

export function validateCanvasSource(
  source: CanvasSourceFiles
): ValidationResult {
  const diagnostics: CanvasDiagnostic[] = []
  const externalDependencies: CanvasExternalDependency[] = []
  const files = Object.keys(source)

  // Check required files
  for (const required of CANVAS_REQUIRED_FILES) {
    if (!(required in source)) {
      diagnostics.push({
        severity: 'error',
        message: `Required file '${required}' is missing`
      })
    }
  }

  // Check for unknown files
  const allowedSet = new Set<string>(
    CANVAS_ALLOWED_FILES as unknown as string[]
  )
  for (const file of files) {
    if (!allowedSet.has(file)) {
      diagnostics.push({
        severity: 'error',
        message: `File '${file}' is not allowed — only ${CANVAS_ALLOWED_FILES.join(', ')} are permitted`,
        file
      })
    }
  }

  // Check per-file size limits
  let totalSize = 0
  for (const file of files) {
    const content = source[file]
    const size = new TextEncoder().encode(content).length
    totalSize += size

    if (size > CANVAS_MAX_FILE_SIZE) {
      diagnostics.push({
        severity: 'error',
        message: `File '${file}' exceeds the per-file size limit of 150 KB (${Math.ceil(size / 1024)} KB)`,
        file
      })
    }
  }

  // Check total source size
  if (totalSize > CANVAS_MAX_TOTAL_SOURCE_SIZE) {
    diagnostics.push({
      severity: 'error',
      message: `Total source size exceeds the limit of 400 KB (${Math.ceil(totalSize / 1024)} KB)`
    })
  }

  // Scan imports in TSX/TS files
  for (const file of files) {
    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = source[file]
      diagnostics.push(...scanImports(content, file))
      diagnostics.push(...scanRemoteInjection(content, file))
    }
  }

  // Validate meta.json if present
  if ('meta.json' in source) {
    const metaContent = source['meta.json']
    let parsed: unknown

    try {
      parsed = JSON.parse(metaContent)
    } catch {
      diagnostics.push({
        severity: 'error',
        message: 'meta.json contains invalid JSON',
        file: 'meta.json'
      })
    }

    if (parsed !== undefined) {
      const result = metaJsonSchema.safeParse(parsed)

      if (!result.success) {
        for (const issue of result.error.issues) {
          diagnostics.push({
            severity: 'error',
            message: `meta.json validation error: ${issue.message} at ${issue.path.join('.')}`,
            file: 'meta.json'
          })
        }
      } else {
        // Check embedded asset payload size
        if (result.data.assets) {
          let totalAssetSize = 0
          for (const [, asset] of Object.entries(result.data.assets)) {
            totalAssetSize += new TextEncoder().encode(asset.data).length
          }

          if (totalAssetSize > CANVAS_MAX_ASSET_PAYLOAD_SIZE) {
            diagnostics.push({
              severity: 'error',
              message: `Embedded asset payload exceeds the 5 MB limit (${Math.ceil(totalAssetSize / (1024 * 1024))} MB)`
            })
          }
        }

        // Surface external dependencies
        if (result.data.externalDependencies) {
          externalDependencies.push(...result.data.externalDependencies)
        }
      }
    }
  }

  return {
    ok: diagnostics.length === 0,
    files,
    diagnostics,
    externalDependencies
  }
}
