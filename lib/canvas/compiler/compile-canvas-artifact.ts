import * as esbuild from 'esbuild'

import { isAllowedCanvasImport } from '@/lib/canvas/allowed-packages'
import {
  CANVAS_COMPILE_TIMEOUT_MS,
  CANVAS_MAX_COMPILED_HTML_SIZE
} from '@/lib/canvas/constants'
import type {
  CanvasCompileProgressPayload,
  CanvasCompileStep,
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
  title?: string
  sourceType?: 'create' | 'update'
  startedAt?: string
  onProgress?: (payload: CanvasCompileProgressPayload) => void
  /** Override for testing — defaults to CANVAS_MAX_COMPILED_HTML_SIZE */
  maxCompiledHtmlSize?: number
  /** Override for testing — defaults to CANVAS_COMPILE_TIMEOUT_MS */
  timeoutMs?: number
}

export type CompileCanvasArtifactResult = {
  ok: boolean
  html?: string
  diagnostics: CanvasDiagnostic[]
  externalDependencies: CanvasExternalDependency[]
}

const COMPILE_STEP_DEFINITIONS: Array<Omit<CanvasCompileStep, 'status'>> = [
  { id: 'generate', label: 'Generating code' },
  { id: 'validate', label: 'Validating source' },
  { id: 'bundle', label: 'Building React components' },
  { id: 'tailwind', label: 'Compiling Tailwind styles' },
  { id: 'assemble', label: 'Bundling output' }
]

/**
 * Build compile steps with statuses. The 'generate' step is always
 * 'completed' at this stage — by the time the compiler runs, the AI
 * has finished writing code. The client-side progress tracker shows
 * 'generate' as 'in-progress' during AI streaming, before these
 * server-side events arrive.
 */
function buildCompileSteps(
  statuses: Partial<
    Record<CanvasCompileStep['id'], CanvasCompileStep['status']>
  >
): CanvasCompileStep[] {
  return COMPILE_STEP_DEFINITIONS.map(step => ({
    ...step,
    status:
      step.id === 'generate' ? 'completed' : (statuses[step.id] ?? 'pending')
  }))
}

function getFirstErrorMessage(
  diagnostics: CanvasDiagnostic[]
): string | undefined {
  return diagnostics.find(d => d.severity === 'error')?.message
}

function emitProgress(input: {
  artifactId?: string
  title?: string
  sourceType?: 'create' | 'update'
  startedAt: string
  onProgress?: (payload: CanvasCompileProgressPayload) => void
  steps: CanvasCompileStep[]
  outcome?: 'success' | 'failed'
  errorMessage?: string
}) {
  if (!input.onProgress || !input.artifactId) return

  input.onProgress({
    artifactId: input.artifactId,
    title: input.title ?? 'Canvas Artifact',
    source: input.sourceType ?? 'update',
    startedAt: input.startedAt,
    steps: input.steps,
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.errorMessage ? { errorMessage: input.errorMessage } : {})
  })
}

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
          const resolved = args.path.startsWith('./')
            ? args.path.replace(/^\.\//, '')
            : args.path

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

          return {
            errors: [
              {
                text: `Virtual file "${args.path}" could not be resolved`
              }
            ]
          }
        }

        // Bare specifiers: allowed ones fall through to esbuild's native
        // resolver (which uses resolveDir from onLoad); block everything else
        if (isAllowedCanvasImport(args.path)) {
          return undefined
        }

        return {
          errors: [
            {
              text: `Canvas compiler does not allow bare specifier "${args.path}". Allowed packages: react, react-dom/client, lucide-react, recharts, motion/react, date-fns.`
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
  const {
    source,
    artifactId,
    revisionId,
    nonce,
    maxCompiledHtmlSize,
    onProgress,
    title,
    sourceType
  } = input
  const sizeLimit = maxCompiledHtmlSize ?? CANVAS_MAX_COMPILED_HTML_SIZE
  const timeoutMs = input.timeoutMs ?? CANVAS_COMPILE_TIMEOUT_MS
  const debugEnabled = process.env.DEBUG_CANVAS_COMPILER === '1'
  const startedAt = input.startedAt ?? new Date().toISOString()

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
  emitProgress({
    artifactId,
    title,
    sourceType,
    startedAt,
    onProgress,
    steps: buildCompileSteps({
      validate: 'in-progress'
    })
  })
  const validation = validateCanvasSource(source)
  if (!validation.ok) {
    emitProgress({
      artifactId,
      title,
      sourceType,
      startedAt,
      onProgress,
      steps: buildCompileSteps({
        validate: 'failed'
      }),
      outcome: 'failed',
      errorMessage: getFirstErrorMessage(validation.diagnostics)
    })
    return {
      ok: false,
      diagnostics: validation.diagnostics,
      externalDependencies: validation.externalDependencies
    }
  }

  // Run the compilation pipeline under a timeout so serverless functions
  // fail gracefully instead of hanging until the platform kills them.
  return new Promise<CompileCanvasArtifactResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      emitProgress({
        artifactId,
        title,
        sourceType,
        startedAt,
        onProgress,
        steps: buildCompileSteps({
          validate: 'completed',
          bundle: 'completed',
          tailwind: 'completed',
          assemble: 'failed'
        }),
        outcome: 'failed',
        errorMessage: `Compilation timed out after ${timeoutMs / 1000}s. The artifact may be too complex — try reducing the number of components or splitting into smaller files.`
      })
      resolve({
        ok: false,
        diagnostics: [
          {
            severity: 'error',
            message: `Compilation timed out after ${timeoutMs / 1000}s. The artifact may be too complex — try reducing the number of components or splitting into smaller files.`
          }
        ],
        externalDependencies: validation.externalDependencies
      })
    }, timeoutMs)

    compileCanvasArtifactCore({
      source,
      validation,
      artifactId,
      revisionId,
      nonce,
      sizeLimit,
      debugEnabled,
      onProgress,
      title,
      sourceType,
      startedAt
    })
      .then(resolve, reject)
      .finally(() => clearTimeout(timer))
  })
}

async function compileCanvasArtifactCore(ctx: {
  source: CanvasSourceFiles
  validation: { externalDependencies: CanvasExternalDependency[] }
  artifactId?: string
  revisionId?: string
  nonce?: string
  sizeLimit: number
  debugEnabled: boolean
  onProgress?: (payload: CanvasCompileProgressPayload) => void
  title?: string
  sourceType?: 'create' | 'update'
  startedAt: string
}): Promise<CompileCanvasArtifactResult> {
  const {
    source,
    validation,
    artifactId,
    revisionId,
    nonce,
    sizeLimit,
    debugEnabled,
    onProgress,
    title,
    sourceType,
    startedAt
  } = ctx

  emitProgress({
    artifactId,
    title,
    sourceType,
    startedAt,
    onProgress,
    steps: buildCompileSteps({
      validate: 'completed',
      bundle: 'in-progress'
    })
  })

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
      emitProgress({
        artifactId,
        title,
        sourceType,
        startedAt,
        onProgress,
        steps: buildCompileSteps({
          validate: 'completed',
          bundle: 'failed'
        }),
        outcome: 'failed',
        errorMessage: getFirstErrorMessage(
          result.errors.map(toCanvasDiagnostic)
        )
      })
      return {
        ok: false,
        diagnostics: result.errors.map(toCanvasDiagnostic),
        externalDependencies: validation.externalDependencies
      }
    }

    const jsOutput = result.outputFiles?.[0]
    if (!jsOutput) {
      emitProgress({
        artifactId,
        title,
        sourceType,
        startedAt,
        onProgress,
        steps: buildCompileSteps({
          validate: 'completed',
          bundle: 'failed'
        }),
        outcome: 'failed',
        errorMessage: 'esbuild produced no JavaScript output'
      })
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
      emitProgress({
        artifactId,
        title,
        sourceType,
        startedAt,
        onProgress,
        steps: buildCompileSteps({
          validate: 'completed',
          bundle: 'failed'
        }),
        outcome: 'failed',
        errorMessage: getFirstErrorMessage(err.errors.map(toCanvasDiagnostic))
      })
      return {
        ok: false,
        diagnostics: err.errors.map(toCanvasDiagnostic),
        externalDependencies: validation.externalDependencies
      }
    }

    const message = err instanceof Error ? err.message : 'Unknown esbuild error'
    emitProgress({
      artifactId,
      title,
      sourceType,
      startedAt,
      onProgress,
      steps: buildCompileSteps({
        validate: 'completed',
        bundle: 'failed'
      }),
      outcome: 'failed',
      errorMessage: `Bundle error: ${message}`
    })
    return {
      ok: false,
      diagnostics: [{ severity: 'error', message: `Bundle error: ${message}` }],
      externalDependencies: validation.externalDependencies
    }
  }

  // Step 3: Compile Tailwind CSS
  emitProgress({
    artifactId,
    title,
    sourceType,
    startedAt,
    onProgress,
    steps: buildCompileSteps({
      validate: 'completed',
      bundle: 'completed',
      tailwind: 'in-progress'
    })
  })
  let css: string
  try {
    css = await buildTailwindCss(source)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown Tailwind error'
    emitProgress({
      artifactId,
      title,
      sourceType,
      startedAt,
      onProgress,
      steps: buildCompileSteps({
        validate: 'completed',
        bundle: 'completed',
        tailwind: 'failed'
      }),
      outcome: 'failed',
      errorMessage: `Tailwind CSS error: ${message}`
    })
    return {
      ok: false,
      diagnostics: [
        { severity: 'error', message: `Tailwind CSS error: ${message}` }
      ],
      externalDependencies: validation.externalDependencies
    }
  }

  // Step 4: Parse meta.json for assets and metadata
  emitProgress({
    artifactId,
    title,
    sourceType,
    startedAt,
    onProgress,
    steps: buildCompileSteps({
      validate: 'completed',
      bundle: 'completed',
      tailwind: 'completed',
      assemble: 'in-progress'
    })
  })
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
    emitProgress({
      artifactId,
      title,
      sourceType,
      startedAt,
      onProgress,
      steps: buildCompileSteps({
        validate: 'completed',
        bundle: 'completed',
        tailwind: 'completed',
        assemble: 'failed'
      }),
      outcome: 'failed',
      errorMessage: `Compiled HTML size (${Math.ceil(htmlSize / (1024 * 1024))} MB) exceeds the 2 MB limit`
    })
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

  emitProgress({
    artifactId,
    title,
    sourceType,
    startedAt,
    onProgress,
    steps: buildCompileSteps({
      validate: 'completed',
      bundle: 'completed',
      tailwind: 'completed',
      assemble: 'completed'
    }),
    outcome: 'success'
  })

  return {
    ok: true,
    html,
    diagnostics: [],
    externalDependencies: validation.externalDependencies
  }
}
