export const TOUR_STEP_IDS = {
  CHAT_INPUT: 'tour-chat-input',
  MODE_SELECTOR: 'mode-selector-trigger',
  SUGGESTIONS: 'tour-suggestions',
  SIDEBAR: 'tour-sidebar'
} as const

export type TourStepId = (typeof TOUR_STEP_IDS)[keyof typeof TOUR_STEP_IDS]

export const TOUR_STORAGE_KEYS = {
  TOUR_STATE_PREFIX: 'polymorph-tour-'
} as const
