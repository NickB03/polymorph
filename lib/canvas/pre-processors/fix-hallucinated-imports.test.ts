// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { CanvasSourceFiles } from '@/lib/types/canvas'

import { fixHallucinatedImports } from './fix-hallucinated-imports'

describe('fixHallucinatedImports', () => {
  it('strips unused unsupported default imports', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import Badge from '@acme/ui'
export default function App() {
  return <div>Hello</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result['App.tsx']).not.toContain("import Badge from '@acme/ui'")
  })

  it('strips unused unsupported named imports', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { Badge } from '@acme/ui'
export default function App() {
  return <div>Hello</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result['App.tsx']).not.toContain("import { Badge } from '@acme/ui'")
  })

  it('strips unused unsupported namespace imports', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import * as Icons from '@acme/icons'
export default function App() {
  return <div>Hello</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result['App.tsx']).not.toContain(
      "import * as Icons from '@acme/icons'"
    )
  })

  it('strips unused unsupported mixed imports', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import Badge, { Icon as BadgeIcon } from '@acme/ui'
export default function App() {
  return <div>Hello</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result['App.tsx']).not.toContain(
      "import Badge, { Icon as BadgeIcon } from '@acme/ui'"
    )
  })

  it('strips unused remote ESM imports', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import Chart from 'https://esm.sh/chart.js'
export default function App() {
  return <div>Hello</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result['App.tsx']).not.toContain(
      "import Chart from 'https://esm.sh/chart.js'"
    )
  })

  it('preserves allowed package imports', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { useState } from 'react'
export default function App() {
  const [count] = useState(0)
  return <div>{count}</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result).toEqual(source)
  })

  it('preserves relative imports', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import Greeting from './components'
export default function App() {
  return <Greeting />
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result).toEqual(source)
  })

  it('preserves disallowed imports when any imported binding is still referenced', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { Badge } from '@acme/ui'
export default function App() {
  return <Badge />
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result).toEqual(source)
  })

  it('does not count comments as binding usage', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { Badge } from '@acme/ui'
// Badge would go here later
export default function App() {
  return <div>Hello</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result['App.tsx']).not.toContain("import { Badge } from '@acme/ui'")
  })

  it('does not count plain string literals as binding usage', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { Badge } from '@acme/ui'
export default function App() {
  return <div title="Badge">Hello</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result['App.tsx']).not.toContain("import { Badge } from '@acme/ui'")
  })

  it('ignores CSS and non-TSX files', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': 'export default function App() { return <div>Hello</div> }',
      'components.ts': "import Badge from '@acme/ui'\nexport const x = 1",
      'styles.css': ".badge { background: url('https://example.com/a.png'); }"
    }

    const result = fixHallucinatedImports(source)

    expect(result['components.ts']).toBe(source['components.ts'])
    expect(result['styles.css']).toBe(source['styles.css'])
  })

  it('does not mutate the original source object', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import Badge from '@acme/ui'
export default function App() {
  return <div>Hello</div>
}
      `
    }

    const snapshot = { ...source }

    fixHallucinatedImports(source)

    expect(source).toEqual(snapshot)
  })
})
