import { describe, expect, it } from 'vitest'

import { getVendorChunkName, getVendorJs } from './index'

describe('vendor registry', () => {
  it('maps react specifiers to react-core chunk', () => {
    expect(getVendorChunkName('react')).toBe('react-core')
    expect(getVendorChunkName('react-dom')).toBe('react-core')
    expect(getVendorChunkName('react-dom/client')).toBe('react-core')
    expect(getVendorChunkName('react/jsx-runtime')).toBe('react-core')
  })

  it('maps each optional package to its own chunk', () => {
    expect(getVendorChunkName('lucide-react')).toBe('lucide-react')
    expect(getVendorChunkName('recharts')).toBe('recharts')
    expect(getVendorChunkName('motion/react')).toBe('motion-react')
    expect(getVendorChunkName('date-fns')).toBe('date-fns')
  })

  it('date-fns subpaths fall through to filesystem (not vendor)', () => {
    expect(getVendorChunkName('date-fns/format')).toBeUndefined()
    expect(getVendorChunkName('date-fns/locale/en-US')).toBeUndefined()
  })

  it('returns undefined for unknown specifiers', () => {
    expect(getVendorChunkName('lodash')).toBeUndefined()
    expect(getVendorChunkName('axios')).toBeUndefined()
  })

  it('always includes react-core in vendor JS output', () => {
    const js = getVendorJs(new Set())
    expect(js).toContain('__CANVAS_VENDOR__')
    expect(js).toContain('__CANVAS_REACT__')
  })

  it('includes only requested chunks plus react-core', () => {
    const js = getVendorJs(new Set(['recharts']))
    expect(js.length).toBeGreaterThan(0)
    const fullJs = getVendorJs(
      new Set(['lucide-react', 'recharts', 'motion-react', 'date-fns'])
    )
    expect(js.length).toBeLessThan(fullJs.length)
  })

  it('does not mutate the input set', () => {
    const input = new Set(['recharts'])
    getVendorJs(input)
    expect(input.has('react-core')).toBe(false)
  })

  it('vendor chunks contain valid JavaScript', () => {
    const js = getVendorJs(
      new Set(['lucide-react', 'recharts', 'motion-react', 'date-fns'])
    )
    expect(() => new Function(js)).not.toThrow()
  })
})
