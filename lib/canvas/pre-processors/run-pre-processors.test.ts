// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { CanvasSourceFiles } from '@/lib/types/canvas'

import { runPreProcessors } from './run-pre-processors'

describe('runPreProcessors', () => {
  it('returns equal content when no processors change the source', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': 'export default function App() { return <div>Hello</div> }',
      'styles.css': '.root { color: red; }',
      'notes.md': '# ignored'
    }

    const result = runPreProcessors(source)

    expect(result).toEqual(source)
  })

  it('does not mutate the input object', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': 'export default function App() { return <div>Hello</div> }'
    }

    const snapshot = { ...source }

    runPreProcessors(source)

    expect(source).toEqual(snapshot)
  })

  it('passes non-TSX files through unchanged', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': 'export default function App() { return <div>Hello</div> }',
      'styles.css': '.root { color: red; }',
      'meta.json': '{"title":"Demo"}'
    }

    const result = runPreProcessors(source)

    expect(result['styles.css']).toBe(source['styles.css'])
    expect(result['meta.json']).toBe(source['meta.json'])
  })
})
