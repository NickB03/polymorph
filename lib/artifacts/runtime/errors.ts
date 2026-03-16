/** Detect errors that indicate the E2B sandbox has expired or been removed. */
export function isSandboxNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  // Primary: E2B SDK sets error.name = 'NotFoundError' for all sandbox-gone cases.
  // Preferred over instanceof to avoid cross-module-boundary issues with bundlers.
  if (error.name === 'NotFoundError') return true
  // Fallback: broad string matching for non-SDK errors or wrapped messages
  const msg = error.message.toLowerCase()
  return (
    msg.includes('sandbox') &&
    (msg.includes('not found') ||
      msg.includes('not running') ||
      msg.includes("wasn't found"))
  )
}
