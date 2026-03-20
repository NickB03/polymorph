import * as esbuild from 'esbuild'

import { CANVAS_MAX_COMPILED_HTML_SIZE } from '@/lib/canvas/constants'
import type {
  CanvasDiagnostic,
  CanvasExternalDependency,
  CanvasMetaJson,
  CanvasSourceFiles
} from '@/lib/types/canvas'

import { validateCanvasSource } from '../validation/validate-canvas-source'

import { assembleCanvasHtml } from './assemble-canvas-html'
import { buildTailwindCss } from './build-tailwind-css'

// ── Types ───────────────────────────────────────────────────────────

export type CompileCanvasArtifactInput = {
  source: CanvasSourceFiles
  artifactId?: string
  revisionId?: string
  nonce?: string
  /** Override for testing — defaults to CANVAS_MAX_COMPILED_HTML_SIZE */
  maxCompiledHtmlSize?: number
}

export type CompileCanvasArtifactResult = {
  ok: boolean
  html?: string
  diagnostics: CanvasDiagnostic[]
  externalDependencies: CanvasExternalDependency[]
}

const ALLOWED_BARE_SPECIFIERS = new Set([
  'react',
  'react-dom/client',
  'react/jsx-runtime'
])

// ── Virtual file esbuild plugin ─────────────────────────────────────

const VIRTUAL_NAMESPACE = 'canvas-virtual'
const ENTRY_POINT = 'canvas-entry.tsx'

function createVirtualPlugin(
  source: CanvasSourceFiles,
  options: {
    artifactId?: string
    revisionId?: string
    debugEnabled?: boolean
  } = {}
): esbuild.Plugin {
  return {
    name: 'canvas-virtual-files',
    setup(build) {
      // Resolve the entry point
      build.onResolve({ filter: new RegExp(`^${ENTRY_POINT}$`) }, () => ({
        path: ENTRY_POINT,
        namespace: VIRTUAL_NAMESPACE
      }))

      // Resolve all imports from within the virtual namespace
      build.onResolve({ filter: /.*/, namespace: VIRTUAL_NAMESPACE }, args => {
        // Relative imports resolve to other virtual files
        if (args.path.startsWith('./') || args.path.startsWith('../')) {
          const resolved = args.path.replace(/^\.\//, '')

          // Try exact match first, then with extensions
          const extensions = ['', '.tsx', '.ts', '.css']
          for (const ext of extensions) {
            const candidate = resolved + ext
            if (candidate in source) {
              return {
                path: candidate,
                namespace: VIRTUAL_NAMESPACE
              }
            }
          }

          // Not found in virtual files — let esbuild handle the error
          return undefined
        }

        // Bare specifiers: allowed ones fall through to esbuild's native
        // resolver (which uses resolveDir from onLoad); block everything else
        if (ALLOWED_BARE_SPECIFIERS.has(args.path)) {
          return undefined
        }

        return {
          errors: [
            {
              text: `Canvas compiler does not allow bare specifier "${args.path}". Only react, react-dom/client, and react/jsx-runtime are permitted.`
            }
          ]
        }
      })

      // Load virtual file content
      build.onLoad({ filter: /.*/, namespace: VIRTUAL_NAMESPACE }, args => {
        const fileName = args.path

        const resolveDir = process.cwd()

        // Entry point that imports and re-exports App
        if (fileName === ENTRY_POINT) {
          return {
            contents: buildEntrySource(source),
            loader: 'tsx',
            resolveDir
          }
        }

        const content = source[fileName]
        if (content === undefined) {
          return {
            errors: [
              {
                text: `Virtual file '${fileName}' not found`
              }
            ]
          }
        }

        const loader = fileName.endsWith('.css') ? 'css' : 'tsx'
        return { contents: content, loader, resolveDir }
      })
    }
  }
}

/**
 * Build the synthetic entry point that imports the user's App and
 * assigns modules to well-known globals for the bootstrap script.
 */
function buildEntrySource(source: CanvasSourceFiles): string {
  const lines = [
    "import * as React from 'react'",
    "import * as ReactDOM from 'react-dom/client'",
    "import * as __App from './App.tsx'"
  ]

  // Import components.tsx if present (so it's included in the bundle)
  if ('components.tsx' in source) {
    lines.push("import './components.tsx'")
  }

  lines.push(
    'globalThis.__CANVAS_REACT__ = React;',
    'globalThis.__CANVAS_REACT_DOM__ = ReactDOM;',
    'globalThis.__CANVAS_APP__ = __App;'
  )

  return lines.join('\n')
}

// ── Parse meta.json ─────────────────────────────────────────────────

function parseMetaJson(source: CanvasSourceFiles): CanvasMetaJson | undefined {
  if (!('meta.json' in source)) return undefined
  try {
    return JSON.parse(source['meta.json']) as CanvasMetaJson
  } catch {
    return undefined
  }
}

function logCanvasCompilerDebug(
  event: string,
  payload: Record<string, unknown>
) {
  console.info(
    '[canvas-compiler]',
    JSON.stringify({
      event,
      ...payload
    })
  )
}

function toCanvasDiagnostic(error: esbuild.Message): CanvasDiagnostic {
  const diagnostic: CanvasDiagnostic = {
    severity: 'error',
    message: error.text,
    file: error.location?.file,
    line: error.location?.line,
    column: error.location?.column
  }

  if (error.detail && typeof error.detail === 'object') {
    diagnostic.details = error.detail as Record<string, unknown>
  }

  return diagnostic
}

function isEsbuildFailure(
  error: unknown
): error is Error & { errors: esbuild.Message[] } {
  return (
    !!error &&
    typeof error === 'object' &&
    'errors' in error &&
    Array.isArray((error as { errors?: unknown }).errors)
  )
}

// ── Main compile pipeline ───────────────────────────────────────────

export async function compileCanvasArtifact(
  input: CompileCanvasArtifactInput
): Promise<CompileCanvasArtifactResult> {
  const { source, artifactId, revisionId, nonce, maxCompiledHtmlSize } = input
  const sizeLimit = maxCompiledHtmlSize ?? CANVAS_MAX_COMPILED_HTML_SIZE
  const debugEnabled = process.env.DEBUG_CANVAS_COMPILER === '1'

  if (debugEnabled) {
    logCanvasCompilerDebug('runtime', {
      artifactId: artifactId ?? null,
      revisionId: revisionId ?? null,
      cwd: process.cwd(),
      nodeVersion: process.versions.node,
      bunVersion: process.versions.bun ?? null
    })
  }

  // Step 1: Validate source
  const validation = validateCanvasSource(source)
  if (!validation.ok) {
    return {
      ok: false,
      diagnostics: validation.diagnostics,
      externalDependencies: validation.externalDependencies
    }
  }

  // Step 2: Bundle with esbuild
  let bundledJs: string
  try {
    const result = await esbuild.build({
      entryPoints: [ENTRY_POINT],
      bundle: true,
      write: false,
      format: 'iife',
      minify: true,
      target: ['es2020'],
      jsx: 'automatic',
      jsxImportSource: 'react',
      absWorkingDir: process.cwd(),
      plugins: [
        createVirtualPlugin(source, {
          artifactId,
          revisionId,
          debugEnabled
        })
      ],
      logLevel: 'silent',
      platform: 'browser'
    })

    if (result.errors.length > 0) {
      return {
        ok: false,
        diagnostics: result.errors.map(toCanvasDiagnostic),
        externalDependencies: validation.externalDependencies
      }
    }

    const jsOutput = result.outputFiles?.[0]
    if (!jsOutput) {
      return {
        ok: false,
        diagnostics: [
          {
            severity: 'error',
            message: 'esbuild produced no JavaScript output'
          }
        ],
        externalDependencies: validation.externalDependencies
      }
    }

    bundledJs = jsOutput.text
  } catch (err) {
    if (isEsbuildFailure(err)) {
      return {
        ok: false,
        diagnostics: err.errors.map(toCanvasDiagnostic),
        externalDependencies: validation.externalDependencies
      }
    }

    const message = err instanceof Error ? err.message : 'Unknown esbuild error'
    return {
      ok: false,
      diagnostics: [{ severity: 'error', message: `Bundle error: ${message}` }],
      externalDependencies: validation.externalDependencies
    }
  }

  // Step 3: Compile Tailwind CSS
  let css: string
  try {
    css = await buildTailwindCss(source)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown Tailwind error'
    return {
      ok: false,
      diagnostics: [
        { severity: 'error', message: `Tailwind CSS error: ${message}` }
      ],
      externalDependencies: validation.externalDependencies
    }
  }

  // Step 4: Parse meta.json for assets and metadata
  const meta = parseMetaJson(source)

  // Step 5: Assemble final HTML
  const html = assembleCanvasHtml({
    js: bundledJs,
    css,
    meta,
    artifactId,
    revisionId,
    nonce
  })

  // Step 6: Check compiled size
  const htmlSize = new TextEncoder().encode(html).length
  if (htmlSize > sizeLimit) {
    return {
      ok: false,
      diagnostics: [
        {
          severity: 'error',
          message: `Compiled HTML size (${Math.ceil(htmlSize / (1024 * 1024))} MB) exceeds the 2 MB limit`
        }
      ],
      externalDependencies: validation.externalDependencies
    }
  }

  return {
    ok: true,
    html,
    diagnostics: [],
    externalDependencies: validation.externalDependencies
  }
}
