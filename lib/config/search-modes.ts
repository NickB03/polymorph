import { MessageSquare } from 'lucide-react'

import { SearchMode } from '@/lib/types/search'

import { IconLogoOutline } from '@/components/ui/icons'

export interface SearchModeConfig {
  value: SearchMode
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

// Centralized search mode configuration
export const SEARCH_MODE_CONFIGS: SearchModeConfig[] = [
  {
    value: 'chat',
    label: 'Chat',
    description: 'Fast, concise responses with web search',
    icon: MessageSquare,
    color: 'text-[#0184FC]'
  },
  {
    value: 'research',
    label: 'Research Agent',
    description: 'Deep research with intelligent query understanding',
    icon: IconLogoOutline,
    color: 'text-violet-500'
  }
]

// Helper function to get a specific mode config
export function getSearchModeConfig(
  mode: SearchMode
): SearchModeConfig | undefined {
  return SEARCH_MODE_CONFIGS.find(config => config.value === mode)
}
