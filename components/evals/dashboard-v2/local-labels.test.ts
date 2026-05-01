import { describe, expect, it } from 'vitest'

import { localLabel } from './local-labels'

describe('localLabel', () => {
  it('returns shortened label for deterministic_prechecks', () => {
    expect(localLabel('deterministic_prechecks')).toBe('Prechecks')
  })

  it('falls through to canonical label for non-overridden keys', () => {
    expect(localLabel('faithfulness')).toBe('Faithfulness')
    expect(localLabel('tool_usage')).toBe('Tool Usage')
  })

  it('falls through for unknown keys', () => {
    expect(localLabel('nonexistent_judge')).toBe('Nonexistent Judge')
  })
})
