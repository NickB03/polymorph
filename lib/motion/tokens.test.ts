import { describe, expect, it } from 'vitest'

import { motionTokens } from './tokens'

describe('motionTokens', () => {
  it('matches the expected tempo triple', () => {
    expect(motionTokens).toEqual({
      duration: {
        entrance: 0.2,
        exit: 0.14,
        stagger: 0.05
      },
      distance: {
        rise: 8
      },
      ease: {
        out: [0.22, 1, 0.36, 1],
        in: [0.64, 0, 0.78, 0]
      }
    })
  })
})
