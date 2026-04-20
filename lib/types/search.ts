// Search mode type definition
export type SearchMode = 'chat' | 'research'

export const VALID_SEARCH_MODES: SearchMode[] = ['chat', 'research']

export function isValidSearchMode(value: unknown): value is SearchMode {
  return (
    typeof value === 'string' &&
    VALID_SEARCH_MODES.includes(value as SearchMode)
  )
}

// User mode type definition (UI vocabulary)
export type UserMode = 'search' | 'research' | 'build'

export const VALID_USER_MODES: UserMode[] = ['search', 'research', 'build']

export function isValidUserMode(value: unknown): value is UserMode {
  return (
    typeof value === 'string' && VALID_USER_MODES.includes(value as UserMode)
  )
}

export function toSearchMode(userMode: UserMode): SearchMode {
  switch (userMode) {
    case 'search':
      return 'chat'
    case 'research':
      return 'research'
    case 'build':
      return 'chat'
  }
}

export function toIntent(userMode: UserMode): string | undefined {
  switch (userMode) {
    case 'search':
      return undefined
    case 'research':
      return undefined
    case 'build':
      return 'build'
  }
}
