import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DateTicker } from './date-ticker'

describe('DateTicker', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('does not emit duplicate-key warnings when labels repeat', () => {
    // Two TrendPoints on the same calendar day or in different years both
    // format to the same "MMM D" label — the renderer must still produce
    // unique React keys.
    const labels = ['May 24', 'May 25', 'May 25', 'May 26']

    render(<DateTicker currentIndex={0} labels={labels} visible />)

    const duplicateKeyWarning = consoleErrorSpy.mock.calls.find(call =>
      String(call[0] ?? '').includes('two children with the same key')
    )
    expect(duplicateKeyWarning).toBeUndefined()
  })

  it('does not emit duplicate-key warnings when month runs repeat across years', () => {
    // Data spanning a year boundary produces month runs like
    // ['Nov','Dec','Jan','Feb','Nov','Dec'] — the month stack must also key
    // by position, not just the month string.
    const labels = ['Nov 30', 'Dec 1', 'Jan 1', 'Feb 1', 'Nov 30', 'Dec 1']

    render(<DateTicker currentIndex={0} labels={labels} visible />)

    const duplicateKeyWarning = consoleErrorSpy.mock.calls.find(call =>
      String(call[0] ?? '').includes('two children with the same key')
    )
    expect(duplicateKeyWarning).toBeUndefined()
  })
})
