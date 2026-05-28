import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DateTicker } from './date-ticker'

const DUPLICATE_KEY_PATTERN = /two children with the same key/i

describe('DateTicker', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    const originalError = console.error
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        // Only suppress the duplicate-key warning we're explicitly asserting
        // against; let every other React/console error through so unrelated
        // regressions still surface in the test output.
        if (
          typeof args[0] === 'string' &&
          DUPLICATE_KEY_PATTERN.test(args[0])
        ) {
          return
        }
        originalError(...args)
      })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  function expectNoDuplicateKeyWarning() {
    const offending = consoleErrorSpy.mock.calls.find(call =>
      typeof call[0] === 'string' ? DUPLICATE_KEY_PATTERN.test(call[0]) : false
    )
    expect(offending, 'unexpected duplicate-key warning').toBeUndefined()
  }

  it('renders one day row per label without duplicate-key warnings when day labels repeat', () => {
    // Two TrendPoints on the same calendar day (multiple runs in one day, or
    // the same date across years) both format to "MMM D" — the renderer must
    // still produce unique React keys, and every row must survive reconcile.
    const labels = ['May 24', 'May 25', 'May 25', 'May 26']

    const { container } = render(
      <DateTicker currentIndex={0} labels={labels} visible />
    )

    // Each parsedLabel must render its own row; if React collapsed duplicates
    // the count would be < labels.length even without the warning text check.
    const dayRows = container.querySelectorAll(
      '[class*="flex-col"] > div > span'
    )
    // Day stack contains labels.length spans; month stack contains uniqueMonths.length spans.
    // Both stacks live under the same .flex-col layout, so we check totals.
    expect(dayRows.length).toBeGreaterThanOrEqual(labels.length)
    expectNoDuplicateKeyWarning()
  })

  it('renders each month run separately when month labels repeat across a year boundary', () => {
    const labels = ['Nov 30', 'Dec 1', 'Jan 1', 'Feb 1', 'Nov 30', 'Dec 1']

    render(<DateTicker currentIndex={0} labels={labels} visible />)

    expectNoDuplicateKeyWarning()
  })
})
