import { describe, expect, it } from 'vitest'

import { buildRadarGridAngles } from './radar-grid'

describe('buildRadarGridAngles', () => {
  it('uses metric angle increments without half-step rotation', () => {
    expect(buildRadarGridAngles(4).map(point => point.angle)).toEqual([
      0, 90, 180, 270, 360
    ])
  })

  it('closes the ring at 360 degrees for non-cardinal metric counts', () => {
    expect(buildRadarGridAngles(8).map(point => point.angle)).toEqual([
      0, 45, 90, 135, 180, 225, 270, 315, 360
    ])
  })

  it('requires at least one metric', () => {
    expect(() => buildRadarGridAngles(0)).toThrow(
      'metricCount must be greater than 0'
    )
  })
})
