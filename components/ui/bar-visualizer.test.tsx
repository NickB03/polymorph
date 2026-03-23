import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  BarVisualizer,
  generateThinkingSequenceBar,
  resolveFrequencyBinRange,
  resolveMultiBandOptions
} from './bar-visualizer'

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

describe('resolveFrequencyBinRange', () => {
  it('maps hz cutoffs to analyser bins instead of using raw array indexes', () => {
    expect(
      resolveFrequencyBinRange({
        loPass: 100,
        hiPass: 200,
        frequencyBinCount: 1024,
        sampleRate: 44100
      })
    ).toEqual({
      loBin: 4,
      hiBin: 10
    })
  })
})

describe('resolveMultiBandOptions', () => {
  it('preserves defaults when callers omit optional overrides', () => {
    expect(
      resolveMultiBandOptions({
        bands: 12
      })
    ).toEqual({
      bands: 12,
      loPass: 100,
      hiPass: 600,
      updateInterval: 32,
      analyserOptions: {
        fftSize: 2048
      }
    })
  })
})

describe('BarVisualizer', () => {
  it('rerenders when forwarded html attributes change', () => {
    const { rerender } = render(
      <BarVisualizer
        aria-label="Voice visualizer"
        data-voice-state="listening"
        demo
      />
    )

    const visualizer = screen.getByLabelText('Voice visualizer')
    expect(visualizer).toHaveAttribute('data-voice-state', 'listening')

    rerender(
      <BarVisualizer
        aria-label="Voice visualizer"
        data-voice-state="speaking"
        demo
      />
    )

    expect(screen.getByLabelText('Voice visualizer')).toHaveAttribute(
      'data-voice-state',
      'speaking'
    )
  })
})
