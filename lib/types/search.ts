// Search mode type definition
export type SearchMode = 'chat' | 'research'

export const VALID_SEARCH_MODES: SearchMode[] = ['chat', 'research']

export function isValidSearchMode(value: unknown): value is SearchMode {
  return (
    typeof value === 'string' &&
    VALID_SEARCH_MODES.includes(value as SearchMode)
  )
}
