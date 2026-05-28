import { describe, expect, it } from 'vitest'

import { CATEGORIES, type Category } from '../categories'

describe('CATEGORIES', () => {
  it('exposes four polymorph categories in the order shown to users', () => {
    expect(CATEGORIES.map(c => c.id)).toEqual([
      'chat-search',
      'research',
      'build',
      'generative-ui'
    ])
  })

  it('every category has the required fields populated', () => {
    for (const c of CATEGORIES) {
      expect(c.id).toBeTruthy()
      expect(c.title).toBeTruthy()
      expect(c.description.length).toBeGreaterThan(20)
      expect(c.Icon).toBeTruthy()
    }
  })

  it('Category type matches the data shape', () => {
    const sample: Category = CATEGORIES[0]
    expect(typeof sample.id).toBe('string')
    expect(typeof sample.title).toBe('string')
    expect(typeof sample.description).toBe('string')
  })
})
