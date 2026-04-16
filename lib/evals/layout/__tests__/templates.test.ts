import { describe, expect, it } from 'vitest'

import { DEFAULT_TEMPLATE_ID, TEMPLATES } from '../templates'
import type { BreakpointKey } from '../types'

const BREAKPOINTS: BreakpointKey[] = ['lg', 'md', 'sm']

describe('templates', () => {
  it('has exactly three templates: a, b, c', () => {
    expect(TEMPLATES.map(t => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('defaults to c (Activity Feed)', () => {
    expect(DEFAULT_TEMPLATE_ID).toBe('c')
  })

  it.each(['a', 'b', 'c'] as const)(
    'template %s: every position references a real item (breakpoints may render a subset)',
    id => {
      const t = TEMPLATES.find(x => x.id === id)!
      const itemIds = new Set(t.items.map(i => i.id))
      for (const bp of BREAKPOINTS) {
        for (const pos of t.layouts[bp]) {
          expect(
            itemIds.has(pos.i),
            `${id}.${bp}: position "${pos.i}" has no matching item in items[]`
          ).toBe(true)
        }
      }
    }
  )
  // Why subset containment and not strict equality:
  // TEMPLATE_A at sm collapses 5 KPI tiles into a single SystemHealthPill
  // (kpi-pass, kpi-overall, kpi-samples, kpi-freshness stay in items[] but
  // have no sm position). Strict equality would force us to either stretch
  // those tiles across a phone viewport or add `hidden: true` sentinel rows.
  // The subset rule says "every rendered position must be real" while letting
  // each breakpoint decide which items to render.

  it.each(['a', 'b', 'c'] as const)(
    'template %s: lg positions stay within 12 columns',
    id => {
      const t = TEMPLATES.find(x => x.id === id)!
      for (const pos of t.layouts.lg) {
        expect(pos.x + pos.w).toBeLessThanOrEqual(12)
        expect(pos.x).toBeGreaterThanOrEqual(0)
        expect(pos.w).toBeGreaterThan(0)
      }
    }
  )
})
