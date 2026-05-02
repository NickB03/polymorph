import { describe, expect, it } from 'vitest'

import { localLabel } from './local-labels'

describe('localLabel', () => {
  it('uses canonical label for deterministic_prechecks', () => {
    expect(localLabel('deterministic_prechecks')).toBe('Eligibility Checks')
  })

  it('falls through to canonical label for non-overridden keys', () => {
    expect(localLabel('faithfulness')).toBe('Groundedness')
    expect(localLabel('tool_usage')).toBe('Tool Usage Quality')
  })

  it('falls through for unknown keys', () => {
    expect(localLabel('nonexistent_judge')).toBe('Nonexistent Judge')
  })
})
