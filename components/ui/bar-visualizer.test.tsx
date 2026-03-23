import { describe, expect, it } from 'vitest'

import { generateThinkingSequenceBar } from './bar-visualizer'

describe('generateThinkingSequenceBar', () => {
  it('produces a sweep that expands from center and contracts back', () => {
    const seq = generateThinkingSequenceBar(7)
    // Center = 3. Sweep out: [3], [2,4], [1,5], [0,6], then back: [1,5], [2,4]
    expect(seq[0]).toEqual([3])
    expect(seq[1]).toEqual([2, 4])
    expect(seq[2]).toEqual([1, 5])
    expect(seq[3]).toEqual([0, 6])
    // Contracts back
    expect(seq[4]).toEqual([1, 5])
    expect(seq[5]).toEqual([2, 4])
    expect(seq.length).toBe(6)
  })

  it('handles even column counts', () => {
    const seq = generateThinkingSequenceBar(6)
    // Center = 3. Sweep: [3], [2,4], [1,5], [0,5], back: [1,5], [2,4]
    expect(seq[0]).toEqual([3])
    expect(seq.length).toBeGreaterThanOrEqual(4)
  })

  it('handles small column count of 1', () => {
    const seq = generateThinkingSequenceBar(1)
    expect(seq[0]).toEqual([0])
    expect(seq.length).toBe(1)
  })
})
