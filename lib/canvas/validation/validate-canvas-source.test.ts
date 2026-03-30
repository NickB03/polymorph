import { describe, expect, it } from 'vitest'

import {
  CANVAS_ALLOWED_FILES,
  CANVAS_MAX_ASSET_PAYLOAD_SIZE,
  CANVAS_MAX_FILE_SIZE,
  CANVAS_MAX_TOTAL_SOURCE_SIZE
} from '@/lib/canvas/constants'

import { validateCanvasSource } from './validate-canvas-source'

describe('validateCanvasSource', () => {
  // ── Required files ──────────────────────────────────────────────────

  it('requires App.tsx to be present', () => {
    const result = validateCanvasSource({
      'styles.css': 'body { color: red }'
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('App.tsx')
        })
      ])
    )
  })

  it('accepts a minimal valid source with only App.tsx', () => {
    const result = validateCanvasSource({
      'App.tsx': 'export default function App() { return <div>Hello</div> }'
    })

    expect(result.ok).toBe(true)
    expect(result.files).toEqual(['App.tsx'])
    expect(result.diagnostics).toEqual([])
  })

  // ── Allowed files ───────────────────────────────────────────────────

  it('accepts all allowed files together', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import Foo from './components'\nexport default function App() { return <Foo /> }",
      'styles.css': 'body { margin: 0 }',
      'components.tsx':
        'export default function Foo() { return <span>Foo</span> }',
      'meta.json': JSON.stringify({ title: 'Test' })
    })

    expect(result.ok).toBe(true)
    expect(result.files).toEqual(
      expect.arrayContaining(CANVAS_ALLOWED_FILES as unknown as string[])
    )
  })

  it('rejects unknown files', () => {
    const result = validateCanvasSource({
      'App.tsx': 'export default function App() { return <div>Hi</div> }',
      'utils.ts': 'export const x = 1'
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('utils.ts')
        })
      ])
    )
  })

  // ── Import restrictions ─────────────────────────────────────────────

  it('allows relative imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import Foo from './components'\nexport default function App() { return <Foo /> }",
      'components.tsx':
        'export default function Foo() { return <span>Foo</span> }'
    })

    expect(result.ok).toBe(true)
  })

  it('allows react and react-dom/client imports', () => {
    const result = validateCanvasSource({
      'App.tsx': `
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
export default function App() { return <div>Hi</div> }
      `
    })

    expect(result.ok).toBe(true)
  })

  it('allows lucide-react imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import { Search, Home } from 'lucide-react'\nexport default function App() { return <div><Search /><Home /></div> }"
    })

    expect(result.ok).toBe(true)
  })

  it('allows recharts imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import { LineChart, Line } from 'recharts'\nexport default function App() { return <LineChart><Line /></LineChart> }"
    })

    expect(result.ok).toBe(true)
  })

  it('allows motion/react imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import { motion } from 'motion/react'\nexport default function App() { return <motion.div>Hi</motion.div> }"
    })

    expect(result.ok).toBe(true)
  })

  it('rejects motion root imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import { motion } from 'motion'\nexport default function App() { return <motion.div>Hi</motion.div> }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain('is not allowed')
  })

  it('allows date-fns imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import { format } from 'date-fns'\nexport default function App() { return <div>{format(new Date(), 'PPP')}</div> }"
    })

    expect(result.ok).toBe(true)
  })

  it('allows date-fns subpath imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import { enUS } from 'date-fns/locale/en-US'\nexport default function App() { return <div>{enUS.code}</div> }"
    })

    expect(result.ok).toBe(true)
  })

  it('rejects remote ESM imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import x from 'https://esm.sh/react'; export default function App() { return null }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain(
      'remote ESM or CDN imports are not allowed'
    )
  })

  it('rejects CDN imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import x from 'https://cdn.jsdelivr.net/npm/lodash'; export default function App() { return null }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain(
      'remote ESM or CDN imports are not allowed'
    )
  })

  it('rejects http:// imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import x from 'http://example.com/module.js'; export default function App() { return null }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain(
      'remote ESM or CDN imports are not allowed'
    )
  })

  it('rejects Node.js API imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import fs from 'fs'; export default function App() { return null }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain(
      'Node.js APIs are not allowed'
    )
  })

  it('rejects node: prefixed imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import path from 'node:path'; export default function App() { return null }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain(
      'Node.js APIs are not allowed'
    )
  })

  it('rejects child_process import', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import cp from 'child_process'; export default function App() { return null }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain(
      'Node.js APIs are not allowed'
    )
  })

  it('rejects arbitrary npm packages', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import _ from 'lodash'; export default function App() { return null }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain('is not allowed')
  })

  it('rejects axios import', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import axios from 'axios'; export default function App() { return null }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain('is not allowed')
  })

  it('rejects dynamic require calls', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "const fs = require('fs'); export default function App() { return null }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain(
      'Node.js APIs are not allowed'
    )
  })

  // ── Remote script/stylesheet injection ──────────────────────────────

  it('rejects remote script tags in JSX', () => {
    const result = validateCanvasSource({
      'App.tsx': `
export default function App() {
  return <div dangerouslySetInnerHTML={{ __html: '<script src="https://evil.com/hack.js"></script>' }} />
}
      `
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain(
      'remote <script> tags are not allowed'
    )
  })

  it('rejects remote stylesheet links in JSX', () => {
    const result = validateCanvasSource({
      'App.tsx': `
export default function App() {
  return <div dangerouslySetInnerHTML={{ __html: '<link rel="stylesheet" href="https://evil.com/styles.css">' }} />
}
      `
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain(
      'remote stylesheet injection is not allowed'
    )
  })

  // ── Server-only framework APIs ──────────────────────────────────────

  it('rejects next/* imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import { useRouter } from 'next/navigation'; export default function App() { return null }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain(
      'server-only framework APIs are not allowed'
    )
  })

  it('rejects @remix-run/* imports', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import { useLoaderData } from '@remix-run/react'; export default function App() { return null }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics[0]?.message).toContain(
      'server-only framework APIs are not allowed'
    )
  })

  // ── Size limits ─────────────────────────────────────────────────────

  it('rejects a single file exceeding the per-file size limit', () => {
    const largeContent =
      'export default function App() { return <div>' +
      'x'.repeat(CANVAS_MAX_FILE_SIZE) +
      '</div> }'

    const result = validateCanvasSource({
      'App.tsx': largeContent
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('150 KB')
        })
      ])
    )
  })

  it('rejects total source exceeding the total size limit', () => {
    // Three files each just under the per-file limit (150 KB each = 450 KB > 400 KB total)
    const almostMaxApp =
      'export default function App() { return <div>' +
      'x'.repeat(CANVAS_MAX_FILE_SIZE - 100) +
      '</div> }'
    const almostMaxCss =
      'body { color: red }' + ' '.repeat(CANVAS_MAX_FILE_SIZE - 100)
    const almostMaxComponents =
      'export default function Foo() { return <span>' +
      'y'.repeat(CANVAS_MAX_FILE_SIZE - 100) +
      '</span> }'

    const result = validateCanvasSource({
      'App.tsx': almostMaxApp,
      'styles.css': almostMaxCss,
      'components.tsx': almostMaxComponents
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('400 KB')
        })
      ])
    )
  })

  // ── meta.json validation ────────────────────────────────────────────

  it('accepts valid meta.json with all optional fields', () => {
    const meta = {
      title: 'My App',
      description: 'A cool app',
      viewport: 'width=device-width, initial-scale=1',
      assets: {
        'logo.png': {
          mimeType: 'image/png',
          data: 'data:image/png;base64,iVBORw0KGgo='
        }
      },
      externalDependencies: [
        {
          type: 'image',
          url: 'https://example.com/bg.jpg',
          label: 'Background'
        }
      ]
    }

    const result = validateCanvasSource({
      'App.tsx': 'export default function App() { return <div>Hi</div> }',
      'meta.json': JSON.stringify(meta)
    })

    expect(result.ok).toBe(true)
    expect(result.externalDependencies).toEqual([
      { type: 'image', url: 'https://example.com/bg.jpg', label: 'Background' }
    ])
  })

  it('rejects invalid meta.json with unknown fields', () => {
    const result = validateCanvasSource({
      'App.tsx': 'export default function App() { return <div>Hi</div> }',
      'meta.json': JSON.stringify({ title: 'OK', unknownField: true })
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          file: 'meta.json'
        })
      ])
    )
  })

  it('rejects invalid meta.json that is not valid JSON', () => {
    const result = validateCanvasSource({
      'App.tsx': 'export default function App() { return <div>Hi</div> }',
      'meta.json': 'not valid json {'
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          file: 'meta.json'
        })
      ])
    )
  })

  it('rejects meta.json with invalid externalDependencies type', () => {
    const result = validateCanvasSource({
      'App.tsx': 'export default function App() { return <div>Hi</div> }',
      'meta.json': JSON.stringify({
        externalDependencies: [
          { type: 'script', url: 'https://evil.com/inject.js' }
        ]
      })
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          file: 'meta.json'
        })
      ])
    )
  })

  // ── Embedded asset cap ──────────────────────────────────────────────

  it('rejects meta.json assets exceeding the 5 MB embedded asset cap', () => {
    const largeData = 'x'.repeat(CANVAS_MAX_ASSET_PAYLOAD_SIZE + 1)

    const result = validateCanvasSource({
      'App.tsx': 'export default function App() { return <div>Hi</div> }',
      'meta.json': JSON.stringify({
        assets: {
          'big.png': { mimeType: 'image/png', data: largeData }
        }
      })
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('5 MB')
        })
      ])
    )
  })

  // ── External dependencies surfacing ─────────────────────────────────

  it('surfaces externalDependencies from meta.json in validation result', () => {
    const result = validateCanvasSource({
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
    })

    expect(result.ok).toBe(true)
    expect(result.externalDependencies).toHaveLength(2)
    expect(result.externalDependencies[0]).toEqual({
      type: 'font',
      url: 'https://fonts.googleapis.com/css2?family=Inter'
    })
    expect(result.externalDependencies[1]).toEqual({
      type: 'api',
      url: 'https://api.example.com/data'
    })
  })

  it('returns empty externalDependencies when meta.json has none', () => {
    const result = validateCanvasSource({
      'App.tsx': 'export default function App() { return <div>Hi</div> }'
    })

    expect(result.ok).toBe(true)
    expect(result.externalDependencies).toEqual([])
  })

  // ── Multiple errors ─────────────────────────────────────────────────

  it('collects multiple validation errors at once', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import fs from 'fs'; import _ from 'lodash'; export default function App() { return null }",
      'hacker.ts': 'alert(1)'
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(3)
  })

  // ── components.tsx import scanning ──────────────────────────────────

  it('scans imports in components.tsx as well', () => {
    const result = validateCanvasSource({
      'App.tsx':
        "import Foo from './components'\nexport default function App() { return <Foo /> }",
      'components.tsx':
        "import axios from 'axios'; export default function Foo() { return <span>Foo</span> }"
    })

    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          file: 'components.tsx',
          message: expect.stringContaining('is not allowed')
        })
      ])
    )
  })
})
