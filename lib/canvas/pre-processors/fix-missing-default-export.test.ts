// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { CanvasSourceFiles } from '@/lib/types/canvas'

import { fixMissingDefaultExport } from './fix-missing-default-export'

describe('fixMissingDefaultExport', () => {
  it('appends export default for function App declarations', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': 'function App() { return <div>Hello</div> }'
    }

    const result = fixMissingDefaultExport(source)

    expect(result['App.tsx']).toContain('function App()')
    expect(result['App.tsx']).toContain('export default App')
  })

  it('appends export default for exported function App declarations', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': 'export function App() { return <div>Hello</div> }'
    }

    const result = fixMissingDefaultExport(source)

    expect(result['App.tsx']).toContain('export function App()')
    expect(result['App.tsx']).toContain('export default App')
  })

  it('appends export default for const App arrow declarations', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': 'const App = () => <div>Hello</div>'
    }

    const result = fixMissingDefaultExport(source)

    expect(result['App.tsx']).toContain('const App = () => <div>Hello</div>')
    expect(result['App.tsx']).toContain('export default App')
  })

  it('appends export default for exported const App arrow declarations', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': 'export const App = () => <div>Hello</div>'
    }

    const result = fixMissingDefaultExport(source)

    expect(result['App.tsx']).toContain(
      'export const App = () => <div>Hello</div>'
    )
    expect(result['App.tsx']).toContain('export default App')
  })

  it('leaves existing default exports untouched', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': 'export default function App() { return <div>Hello</div> }'
    }

    const result = fixMissingDefaultExport(source)

    expect(result).toEqual(source)
  })

  it('leaves unsupported patterns untouched', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': 'const App = function App() { return <div>Hello</div> }'
    }

    const result = fixMissingDefaultExport(source)

    expect(result).toEqual(source)
  })

  it('leaves files other than App.tsx untouched', () => {
    const source: CanvasSourceFiles = {
      'components.tsx': 'function App() { return <div>Hello</div> }',
      'App.tsx': 'export default function App() { return <div>Hello</div> }'
    }

    const result = fixMissingDefaultExport(source)

    expect(result['components.tsx']).toBe(source['components.tsx'])
    expect(result['App.tsx']).toBe(source['App.tsx'])
  })
})
