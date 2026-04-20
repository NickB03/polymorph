import { Blocks, Compass, Search } from 'lucide-react'

import { SearchMode, UserMode } from '@/lib/types/search'

export interface SearchModeConfig {
  value: UserMode
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  backendMode: SearchMode
  intent?: string
}

// Centralized search mode configuration
export const SEARCH_MODE_CONFIGS: SearchModeConfig[] = [
  {
    value: 'search',
    label: 'Search',
    description: 'Fast, concise responses with web search',
    icon: Search,
    color: 'text-muted-foreground',
    backendMode: 'chat'
  },
  {
    value: 'research',
    label: 'Research',
    description: 'Deep research with intelligent query understanding',
    icon: Compass,
    color: 'text-accent-blue',
    backendMode: 'research'
  },
  {
    value: 'build',
    label: 'Build',
    description: 'Generate interactive artifacts and apps',
    icon: Blocks,
    color: 'text-accent-amber',
    backendMode: 'chat',
    intent: 'build'
  }
]

// Helper function to get a specific mode config by UserMode
export function getSearchModeConfig(
  mode: UserMode
): SearchModeConfig | undefined {
  return SEARCH_MODE_CONFIGS.find(config => config.value === mode)
}

// Transitional helper: look up a config by its backend SearchMode.
// Used by the legacy selector (which still speaks SearchMode) until it's
// rewritten in a later task. Returns the first config whose backendMode
// matches — ambiguous for 'chat' (both Search and Build map to it), so
// prefer `getSearchModeConfig(userMode)` for new callers.
export function getConfigByBackendMode(
  mode: SearchMode
): SearchModeConfig | undefined {
  return SEARCH_MODE_CONFIGS.find(config => config.backendMode === mode)
}
