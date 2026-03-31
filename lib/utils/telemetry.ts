/**
 * Check if tracing is enabled
 * Default: false
 */
export function isTracingEnabled(): boolean {
  return process.env.ENABLE_TRACING === 'true'
}
