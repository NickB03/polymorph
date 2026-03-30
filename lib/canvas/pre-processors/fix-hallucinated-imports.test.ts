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

  it('preserves lucide-react imports when bindings are used', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { Search } from 'lucide-react'
export default function App() {
  return <Search />
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result).toEqual(source)
  })

  it('preserves recharts imports when bindings are used', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { Line, LineChart } from 'recharts'
export default function App() {
  return <LineChart><Line /></LineChart>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result).toEqual(source)
  })

  it('preserves motion/react imports when bindings are used', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { motion } from 'motion/react'
export default function App() {
  return <motion.div>Hi</motion.div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result).toEqual(source)
  })

  it('preserves date-fns imports when bindings are used', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { format } from 'date-fns'
export default function App() {
  return <div>{format(new Date(), 'PPP')}</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result).toEqual(source)
  })

  it('preserves date-fns subpath imports when bindings are used', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { enUS } from 'date-fns/locale/enUS'
export default function App() {
  return <div>{enUS.code}</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result).toEqual(source)
  })

  it('preserves unused date-fns subpath imports because they are supported', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { enUS } from 'date-fns/locale/enUS'
export default function App() {
  return <div>Hello</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result).toEqual(source)
  })

  it('still strips unsupported lookalike imports when unused', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { Search } from 'lucide-react/dist/esm/icons/search'
export default function App() {
  return <div>Hello</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result['App.tsx']).not.toContain(
      'lucide-react/dist/esm/icons/search'
    )
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

  it('preserves disallowed imports when a referenced binding contains $', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { Badge as $Badge } from '@acme/ui'
export default function App() {
  return <$Badge />
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

  it('preserves unsupported imports when a URL literal and binding share a line', () => {
    const source: CanvasSourceFiles = {
      'App.tsx': `
import { Badge } from '@acme/ui'
export default function App() {
  return <div>{fn("https://example.com", Badge)}</div>
}
      `
    }

    const result = fixHallucinatedImports(source)

    expect(result).toEqual(source)
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
