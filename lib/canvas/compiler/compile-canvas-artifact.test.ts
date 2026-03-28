// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { compileCanvasArtifact } from './compile-canvas-artifact'

describe('compileCanvasArtifact', () => {
  // ── Successful compilation ──────────────────────────────────────────

  it('assembles one HTML document with inline JS and CSS', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx':
          'export default function App() { return <div className="p-4 text-red-500">Hi</div> }'
      }
    })

    expect(result.ok).toBe(true)
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain("default-src 'none'")
    expect(result.html).not.toContain('https://unpkg.com')
    expect(result.html).not.toContain('https://cdn.jsdelivr.net')
    expect(result.html).not.toContain('https://esm.sh')
  })

  it('bundles React and ReactDOM inline instead of loading from CDN', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': `
import { useState } from 'react'
export default function App() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
        `
      }
    })

    expect(result.ok).toBe(true)
    // Should contain bundled React code (useState is part of React)
    expect(result.html).toContain('useState')
    // Should not load React from a CDN
    expect(result.html).not.toContain('https://unpkg.com/react')
    expect(result.html).not.toContain('https://cdn.jsdelivr.net')
    expect(result.html).not.toContain('https://esm.sh/react')
  })

  it('renders Tailwind utilities into CSS', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx':
          'export default function App() { return <div className="text-red-500 bg-blue-200 flex items-center">Hi</div> }'
      }
    })

    expect(result.ok).toBe(true)
    // Tailwind should generate actual CSS for these utility classes
    expect(result.html).toContain('text-red-500')
    expect(result.html).toContain('bg-blue-200')
  })

  it('inlines meta.json assets into the final HTML', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': 'export default function App() { return <div>Hi</div> }',
        'meta.json': JSON.stringify({
          assets: {
            'logo.png': {
              mimeType: 'image/png',
              data: 'data:image/png;base64,iVBORw0KGgo='
            }
          }
        })
      }
    })

    expect(result.ok).toBe(true)
    expect(result.html).toContain('data:image/png;base64,iVBORw0KGgo=')
  })

  // ── CSP meta tag ────────────────────────────────────────────────────

  it('includes the locked CSP meta tag', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': 'export default function App() { return <div>Hi</div> }'
      }
    })

    expect(result.ok).toBe(true)
    expect(result.html).toContain(
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https: blob:; font-src data: https: blob:; media-src data: https: blob:; connect-src https:; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'; navigate-to 'none'"
    )
  })

  // ── Preview bootstrap ───────────────────────────────────────────────

  it('preview bootstrap injects nonce-scoped message bridge', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': 'export default function App() { return <div>Hi</div> }'
      },
      artifactId: 'test-artifact',
      revisionId: 'test-revision',
      nonce: 'test-nonce-123'
    })

    expect(result.ok).toBe(true)
    expect(result.html).toContain('canvas-preview')
    expect(result.html).toContain('preview-ready')
    expect(result.html).toContain('test-artifact')
    expect(result.html).toContain('test-revision')
    expect(result.html).toContain('test-nonce-123')
    expect(result.html).toContain('parentOrigin')
    expect(result.html).toContain("window.__CANVAS_IMAGE_BASE__ = ''")
    expect(result.html).toContain(
      "(parentOrigin.endsWith('/') ? parentOrigin.slice(0, -1) : parentOrigin)"
    )
    expect(result.html).not.toContain("}, '*');")
  })

  it('preview bootstrap includes runtime diagnostics hooks', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': 'export default function App() { return <div>Hi</div> }'
      }
    })

    expect(result.ok).toBe(true)
    // Should include error event listener
    expect(result.html).toContain('runtime-error')
    // Should include unhandledrejection listener
    expect(result.html).toContain('unhandled-rejection')
    // Should include asset error listener
    expect(result.html).toContain('asset-error')
    // Should include external request error listener
    expect(result.html).toContain('external-request-error')
  })

  // ── Output size limit ───────────────────────────────────────────────

  it('rejects compiled output exceeding the compiled HTML size limit', async () => {
    // A minimal app compiles to ~200 KB (mostly React).
    // We set maxCompiledHtmlSize to a small value to test the guard.
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': 'export default function App() { return <div>Hi</div> }'
      },
      maxCompiledHtmlSize: 1024 // 1 KB — smaller than any valid output
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('exceeds')
        })
      ])
    )
  })

  // ── Compile errors as structured diagnostics ────────────────────────

  it('returns structured diagnostics for compile errors instead of throwing', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': 'this is not valid typescript {'
      }
    })

    expect(result.ok).toBe(false)
    expect(result.html).toBeUndefined()
    expect(result.diagnostics.length).toBeGreaterThan(0)
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        severity: 'error'
      })
    )
  })

  // ── Validation pass-through ─────────────────────────────────────────

  it('returns validation diagnostics when source is invalid', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx':
          "import fs from 'fs'; export default function App() { return null }"
      }
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('Node.js APIs')
        })
      ])
    )
  })

  // ── Multi-file compilation ──────────────────────────────────────────

  it('compiles multi-file source with components.tsx', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': `
import Greeting from './components'
export default function App() { return <Greeting name="World" /> }
        `,
        'components.tsx': `
export default function Greeting({ name }: { name: string }) {
  return <h1 className="text-2xl font-bold">Hello, {name}!</h1>
}
        `
      }
    })

    expect(result.ok).toBe(true)
    expect(result.html).toContain('<!DOCTYPE html>')
  })

  // ── Custom styles.css ───────────────────────────────────────────────

  it('includes authored styles.css in output', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx':
          'export default function App() { return <div className="my-custom-class">Hi</div> }',
        'styles.css': '.my-custom-class { color: hotpink; }'
      }
    })

    expect(result.ok).toBe(true)
    expect(result.html).toContain('color: hotpink')
  })

  it('escapes viewport metadata before interpolating it into HTML', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': 'export default function App() { return <div>Hi</div> }',
        'meta.json': JSON.stringify({
          viewport: 'width=device-width"><script>alert(1)</script>'
        })
      }
    })

    expect(result.ok).toBe(true)
    expect(result.html).toContain(
      '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'
    )
    expect(result.html).not.toContain('<script>alert(1)</script>')
  })

  it('neutralizes authored CSS that tries to close the style tag', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': 'export default function App() { return <div>Hi</div> }',
        'styles.css': '.safe { color: red; }</style><script>alert(1)</script>'
      }
    })

    expect(result.ok).toBe(true)
    expect(result.html).toContain('<\\/style><script>alert(1)</script>')
    expect(result.html).not.toContain('</style><script>alert(1)</script>')
  })

  it('rejects unresolved parent-directory imports as missing virtual files', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': `
import Missing from '../missing'
export default function App() { return <Missing /> }
        `
      }
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining(
            'Virtual file "../missing" could not be resolved'
          )
        })
      ])
    )
  })

  // ── External dependencies from meta.json ────────────────────────────

  it('surfaces externalDependencies from meta.json in compile result', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': 'export default function App() { return <div>Hi</div> }',
        'meta.json': JSON.stringify({
          externalDependencies: [
            {
              type: 'font',
              url: 'https://fonts.googleapis.com/css2?family=Inter'
            },
            { type: 'api', url: 'https://api.example.com/data' }
          ]
        })
      }
    })

    expect(result.ok).toBe(true)
    expect(result.externalDependencies).toHaveLength(2)
    expect(result.externalDependencies[0]).toEqual({
      type: 'font',
      url: 'https://fonts.googleapis.com/css2?family=Inter'
    })
  })

  it('compiles pre-processed source that already has a default export', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx':
          'const App = () => <div>Recovered</div>\n\nexport default App\n'
      }
    })

    expect(result.ok).toBe(true)
    expect(result.diagnostics).toEqual([])
  })

  it('surfaces diagnostics when an unsupported import is still referenced', async () => {
    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': `
import { Badge } from '@acme/ui'
export default function App() {
  return <Badge />
}
        `
      }
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining(
            'arbitrary npm packages are not allowed'
          )
        })
      ])
    )
  })
})
