// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  CANVAS_ALLOWED_PACKAGES,
  isAllowedCanvasImport
} from './allowed-packages'

describe('CANVAS_ALLOWED_PACKAGES', () => {
  it('is a non-empty array of package definitions', () => {
    expect(CANVAS_ALLOWED_PACKAGES.length).toBeGreaterThan(0)

    for (const pkg of CANVAS_ALLOWED_PACKAGES) {
      expect(pkg).toHaveProperty('specifier')
    }
  })
})

describe('isAllowedCanvasImport', () => {
  it('allows "react"', () => {
    expect(isAllowedCanvasImport('react')).toBe(true)
  })

  it('allows "react-dom/client"', () => {
    expect(isAllowedCanvasImport('react-dom/client')).toBe(true)
  })

  it('allows "react/jsx-runtime"', () => {
    expect(isAllowedCanvasImport('react/jsx-runtime')).toBe(true)
  })

  it('allows "lucide-react"', () => {
    expect(isAllowedCanvasImport('lucide-react')).toBe(true)
  })

  it('allows "recharts"', () => {
    expect(isAllowedCanvasImport('recharts')).toBe(true)
  })

  it('allows "motion/react"', () => {
    expect(isAllowedCanvasImport('motion/react')).toBe(true)
  })

  it('allows "motion"', () => {
    expect(isAllowedCanvasImport('motion')).toBe(true)
  })

  it('allows "date-fns"', () => {
    expect(isAllowedCanvasImport('date-fns')).toBe(true)
  })

  it('allows "date-fns/format" (subpath)', () => {
    expect(isAllowedCanvasImport('date-fns/format')).toBe(true)
  })

  it('allows "date-fns/locale/enUS" (deep subpath)', () => {
    expect(isAllowedCanvasImport('date-fns/locale/enUS')).toBe(true)
  })

  it('rejects "lodash"', () => {
    expect(isAllowedCanvasImport('lodash')).toBe(false)
  })

  it('rejects "axios"', () => {
    expect(isAllowedCanvasImport('axios')).toBe(false)
  })

  it('rejects "fs"', () => {
    expect(isAllowedCanvasImport('fs')).toBe(false)
  })

  it('rejects "next"', () => {
    expect(isAllowedCanvasImport('next')).toBe(false)
  })

  it('rejects relative imports (not its job)', () => {
    expect(isAllowedCanvasImport('./components')).toBe(false)
  })

  it('rejects "react-dom" without subpath', () => {
    expect(isAllowedCanvasImport('react-dom')).toBe(false)
  })

  it('rejects "lucide-react/dist/something" (non-root subpath)', () => {
    expect(isAllowedCanvasImport('lucide-react/dist/something')).toBe(false)
  })

  it('rejects "recharts/lib/internals"', () => {
    expect(isAllowedCanvasImport('recharts/lib/internals')).toBe(false)
  })
})
