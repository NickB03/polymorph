// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { fixMissingLucideIcons } from './fix-missing-lucide-icons'

describe('fixMissingLucideIcons', () => {
  it('aliases removed brand icons to the fallback icon', () => {
    const result = fixMissingLucideIcons({
      'App.tsx':
        "import { Coffee, Instagram, Github as Gh } from 'lucide-react'"
    })

    expect(result['App.tsx']).toBe(
      "import { Coffee, Globe as Instagram, Globe as Gh } from 'lucide-react'"
    )
  })

  it('handles multi-line imports and leaves type imports alone', () => {
    const result = fixMissingLucideIcons({
      'App.tsx': `import {\n  Star,\n  type LucideIcon,\n  Facebook,\n} from "lucide-react"`
    })

    expect(result['App.tsx']).toBe(
      `import {\n  Star,\n  type LucideIcon,\n  Globe as Facebook,\n} from "lucide-react"`
    )
  })

  it('leaves valid imports, other packages and non-tsx files untouched', () => {
    const source = {
      'App.tsx':
        "import { Menu, X } from 'lucide-react'\nimport { Instagram } from './icons'",
      'styles.css': 'body {}'
    }

    expect(fixMissingLucideIcons(source)).toEqual(source)
  })
})
