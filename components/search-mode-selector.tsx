'use client'

import { useEffect, useState } from 'react'

import { Check, ChevronDown } from 'lucide-react'

import { SEARCH_MODE_CONFIGS } from '@/lib/config/search-modes'
import { SearchMode } from '@/lib/types/search'
import { cn } from '@/lib/utils'
import { getCookie, setCookie } from '@/lib/utils/cookies'

import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu'

export function SearchModeSelector() {
  const [value, setValue] = useState<SearchMode>('chat')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    const savedMode = getCookie('searchMode')
    // Backward compat: map old values to new ones
    const mapped =
      savedMode === 'quick'
        ? 'chat'
        : savedMode === 'adaptive'
          ? 'research'
          : savedMode
    if (mapped && ['chat', 'research'].includes(mapped)) {
      setValue(mapped as SearchMode)
      // Overwrite cookie if it had an old value
      if (mapped !== savedMode) {
        setCookie('searchMode', mapped)
      }
    } else if (savedMode) {
      // Clean up invalid cookie value
      setCookie('searchMode', 'chat')
      setValue('chat')
    }
  }, [])

  // Sync local state when cookie is changed programmatically (e.g. research suggestion)
  useEffect(() => {
    const handleChange = () => {
      const mode = getCookie('searchMode')
      if (mode && ['chat', 'research'].includes(mode)) {
        setValue(mode as SearchMode)
      }
    }
    window.addEventListener('searchModeChanged', handleChange)
    return () => window.removeEventListener('searchModeChanged', handleChange)
  }, [])

  const handleModeSelect = (mode: SearchMode) => {
    setValue(mode)
    setCookie('searchMode', mode)
    setDropdownOpen(false)
  }

  const selectedMode = SEARCH_MODE_CONFIGS.find(
    config => config.value === value
  )
  const SelectedIcon = selectedMode?.icon

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="text-sm rounded-full shadow-none gap-1 transition-all"
        >
          {SelectedIcon && (
            <SelectedIcon
              className={cn('h-4 w-4 transition-colors', selectedMode?.color)}
            />
          )}
          <span className="text-xs font-medium">{selectedMode?.label}</span>
          <ChevronDown
            className={cn(
              'h-3 w-3 ml-1 opacity-50 transition-transform duration-200',
              dropdownOpen && 'rotate-180'
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" sideOffset={5}>
        {SEARCH_MODE_CONFIGS.map(config => {
          const ModeIcon = config.icon
          const isSelected = value === config.value
          return (
            <DropdownMenuItem
              key={config.value}
              onClick={() => handleModeSelect(config.value)}
              className="relative flex flex-col items-start gap-1 py-2 pl-8 pr-2 cursor-pointer focus:outline-none"
            >
              {isSelected && (
                <Check className="absolute left-2 top-2.5 h-4 w-4" />
              )}
              <div className="flex items-center gap-2">
                <ModeIcon
                  className={cn('h-4 w-4 transition-colors', config.color)}
                />
                <span className="text-sm font-medium">{config.label}</span>
              </div>
              <div className="flex flex-col gap-0.5 ml-6">
                <span className="text-xs text-muted-foreground">
                  {config.description}
                </span>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
