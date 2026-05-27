import { describe, expect, it } from 'vitest'

import { TOUR_STEP_IDS, TOUR_STORAGE_KEYS } from '../tour-constants'

describe('TOUR_STEP_IDS', () => {
  it('exposes the four Polymorph tour targets', () => {
    expect(TOUR_STEP_IDS).toEqual({
      CHAT_INPUT: 'tour-chat-input',
      MODE_SELECTOR: 'mode-selector-trigger',
      SUGGESTIONS: 'tour-suggestions',
      SIDEBAR: 'tour-sidebar'
    })
  })

  it('reuses the existing mode-selector trigger id rather than duplicating it', () => {
    expect(TOUR_STEP_IDS.MODE_SELECTOR).toBe('mode-selector-trigger')
  })
})

describe('TOUR_STORAGE_KEYS', () => {
  it('namespaces all keys under polymorph-tour-', () => {
    expect(TOUR_STORAGE_KEYS.TOUR_STATE_PREFIX).toBe('polymorph-tour-')
    expect(TOUR_STORAGE_KEYS.FORCE_TOUR).toBe('polymorph-tour-force-mode')
  })
})
