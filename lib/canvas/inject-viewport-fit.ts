/**
 * Base CSS injected into canvas artifact HTML so content fills the
 * iframe / browser viewport rather than overflowing.
 *
 * - `html, body, #root` get `height: 100%` to establish a full-height
 *   chain from the viewport to the React mount point.
 * - `#root > *` gets `max-height: 100vh` to prevent children that use
 *   `min-h-screen` from exceeding the viewport.
 * - All rules are low-specificity — user/Tailwind CSS wins.
 */
const VIEWPORT_FIT_STYLE =
  '<style>html,body,#root{height:100%;margin:0}#root>*{max-height:100vh;box-sizing:border-box}</style>'

/**
 * Inject viewport-fit base styles into compiled canvas HTML.
 * Skips injection if the styles are already present (newly compiled artifacts).
 */
export function injectViewportFitStyles(html: string): string {
  if (!html) return html
  // Already has the base styles (newly compiled artifacts)
  if (html.includes('html,body,#root{height:100%')) return html
  // Insert before the first <style> or at end of <head>
  const insertionPoint =
    html.indexOf('<style') !== -1
      ? html.indexOf('<style')
      : html.indexOf('</head>')
  if (insertionPoint === -1) return html
  return (
    html.slice(0, insertionPoint) +
    VIEWPORT_FIT_STYLE +
    html.slice(insertionPoint)
  )
}
