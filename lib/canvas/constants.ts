// Locked v1 allowed file names
export const CANVAS_ALLOWED_FILES = [
  'App.tsx',
  'styles.css',
  'components.tsx',
  'meta.json'
] as const

export const CANVAS_REQUIRED_FILES = ['App.tsx'] as const

// Locked v1 size limits
export const CANVAS_MAX_FILES = 4
export const CANVAS_MAX_FILE_SIZE = 150 * 1024 // 150 KB
export const CANVAS_MAX_TOTAL_SOURCE_SIZE = 400 * 1024 // 400 KB
export const CANVAS_MAX_COMPILED_HTML_SIZE = 2 * 1024 * 1024 // 2 MB
export const CANVAS_MAX_ASSET_PAYLOAD_SIZE = 5 * 1024 * 1024 // 5 MB
export const CANVAS_MAX_VERSIONS = 50

// Compilation timeout (ms) — prevents serverless hangs on cold starts
export const CANVAS_COMPILE_TIMEOUT_MS = 30_000

// Status values
export const CANVAS_STATUSES = [
  'generating',
  'compiling',
  'ready',
  'compile_failed',
  'restoring'
] as const

// Tool names
export const CANVAS_TOOL_NAMES = [
  'createCanvasArtifact',
  'updateCanvasArtifact'
] as const

// Data part names
export const CANVAS_DATA_PART_NAMES = {
  artifact: 'data-canvasArtifact',
  status: 'data-canvasArtifactStatus',
  event: 'data-canvasArtifactEvent',
  diagnostics: 'data-canvasDiagnostics'
} as const

// Allowed imports
export const CANVAS_ALLOWED_PACKAGE_IMPORTS = [
  'react',
  'react-dom/client'
] as const

// Version created by
export const CANVAS_VERSION_CREATED_BY = ['ai', 'user', 'restore'] as const
