import { describe, expect, it } from 'vitest'

import {
  healthForScore,
  stateBg,
  stateColor,
  stateLabel
} from '../health-state'

describe('healthForScore', () => {
  it('returns healthy when score >= healthy threshold', () => {
    expect(healthForScore(0.92, 0.9, 0.75)).toBe('healthy')
    expect(healthForScore(0.9, 0.9, 0.75)).toBe('healthy')
  })

  it('returns warning when score is between warning and healthy', () => {
    expect(healthForScore(0.8, 0.9, 0.75)).toBe('warning')
    expect(healthForScore(0.75, 0.9, 0.75)).toBe('warning')
  })

  it('returns critical when score < warning', () => {
    expect(healthForScore(0.7, 0.9, 0.75)).toBe('critical')
    expect(healthForScore(0, 0.9, 0.75)).toBe('critical')
  })
})

describe('stateColor / stateBg / stateLabel', () => {
  it('returns stable tailwind classes per state', () => {
    expect(stateColor('healthy')).toContain('emerald')
    expect(stateColor('warning')).toContain('amber')
    expect(stateColor('critical')).toContain('rose')
    expect(stateBg('healthy')).toContain('emerald')
    expect(stateBg('warning')).toContain('amber')
    expect(stateBg('critical')).toContain('rose')
    expect(stateLabel('healthy')).toBe('Healthy')
    expect(stateLabel('warning')).toBe('Warning')
    expect(stateLabel('critical')).toBe('Critical')
  })
})
