'use client'

import { useEffect, useRef, useState } from 'react'

import { Ellipsis, X } from 'lucide-react'

import { SEARCH_MODE_CONFIGS } from '@/lib/config/search-modes'
import { UserMode } from '@/lib/types/search'
import { cn } from '@/lib/utils'
import { getCookie } from '@/lib/utils/cookies'
import {
  mapSearchModeCookieValue,
  readSearchModeCookie,
  syncSearchMode
} from '@/lib/utils/search-mode'

import { PillPresence } from '@/components/motion/pill-presence'

import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu'

// Tailwind classes keyed on the mode's active-pill color. Keeping these inline
// lets the static class names survive Tailwind's JIT pass — string
// interpolation into class names would not.
const ACTIVE_PILL_CLASSES: Record<
  Exclude<UserMode, 'search'>,
  {
    container: string
    trigger: string
    icon: string
    label: string
    close: string
  }
> = {
  research: {
    container: 'bg-accent-blue/10 border-accent-blue/30',
    trigger: 'hover:bg-accent-blue/15',
    icon: 'text-accent-blue',
    label: 'text-accent-blue',
    close: 'text-accent-blue hover:bg-accent-blue/20'
  },
  build: {
    container: 'bg-accent-amber/10 border-accent-amber/30',
    trigger: 'hover:bg-accent-amber/15',
    icon: 'text-accent-amber',
    label: 'text-accent-amber',
    close: 'text-accent-amber hover:bg-accent-amber/20'
  }
}

const MODE_SELECTOR_TRIGGER_ID = 'mode-selector-trigger'

export function ModeSelector() {
  // Deterministic initial state — matches SSR output so hydration is stable.
  // The cookie-derived value is promoted on mount in the effect below.
  const [value, setValue] = useState<UserMode>('search')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  // Shared ref attached to whichever DropdownMenuTrigger is currently rendered
  // (pill button when a mode is active, Ellipsis button otherwise). Used to
  // restore focus after the active pill unmounts on clear — otherwise focus
  // falls to <body>, breaking keyboard/SR flow.
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pendingFocusRef = useRef(false)

  // After the X-button unmounts, move focus to the now-rendered Ellipsis
  // trigger. Runs post-commit so the new button is mounted and focusable.
  useEffect(() => {
    if (pendingFocusRef.current && value === 'search') {
      pendingFocusRef.current = false
      triggerRef.current?.focus()
    }
  }, [value])

  useEffect(() => {
    const raw = getCookie('searchMode')
    const mapped = mapSearchModeCookieValue(raw)
    // why: external-source sync — the cookie is the source of truth for the
    // persisted mode. Promoting its value on mount is the allowed
    // setState-in-effect case.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- promote the persisted cookie mode after mount without changing SSR output
    setValue(mapped)
    // Normalize legacy cookie values (e.g. 'quick', 'adaptive', 'chat') by
    // rewriting the cookie to the mapped UserMode on first read.
    if (raw && raw !== mapped) syncSearchMode(mapped)
  }, [])

  // Sync when the cookie is changed programmatically (e.g. research suggestion)
  useEffect(() => {
    const handleChange = () => {
      setValue(readSearchModeCookie())
    }
    window.addEventListener('searchModeChanged', handleChange)
    return () => window.removeEventListener('searchModeChanged', handleChange)
  }, [])

  const handleSelect = (mode: UserMode) => {
    setValue(mode)
    syncSearchMode(mode)
    setDropdownOpen(false)
  }

  const handleClearActive = (e: React.MouseEvent) => {
    // Prevent the surrounding Radix Trigger from interpreting this as
    // "open the dropdown."
    e.stopPropagation()
    // Signal the post-commit effect to restore focus to the Ellipsis trigger
    // once the active pill (and its X button) has unmounted.
    pendingFocusRef.current = true
    setValue('search')
    syncSearchMode('search')
  }

  const activeMode: Exclude<UserMode, 'search'> | null =
    value === 'search' ? null : value
  const activeConfig = activeMode
    ? SEARCH_MODE_CONFIGS.find(config => config.value === activeMode)
    : null

  if (!activeMode || !activeConfig) {
    return (
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            id={MODE_SELECTOR_TRIGGER_ID}
            variant="outline"
            size="icon"
            className="rounded-full"
            type="button"
            aria-label="Open mode menu"
          >
            <Ellipsis className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <ModeDropdownContent onSelect={handleSelect} />
      </DropdownMenu>
    )
  }

  const styles = ACTIVE_PILL_CLASSES[activeMode]
  const Icon = activeConfig.icon

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <PillPresence activeKey={activeMode}>
        <div
          className={cn(
            'inline-flex items-center h-11 rounded-full border transition-colors',
            styles.container
          )}
        >
          <DropdownMenuTrigger asChild>
            <button
              ref={triggerRef}
              id={MODE_SELECTOR_TRIGGER_ID}
              type="button"
              aria-label={`Mode: ${activeConfig.label}. Open mode menu`}
              className={cn(
                'inline-flex items-center gap-2 h-full pl-3.5 pr-2.5 rounded-l-full text-sm font-medium transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                styles.trigger
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', styles.icon)} />
              <span className={styles.label}>{activeConfig.label}</span>
            </button>
          </DropdownMenuTrigger>
          <button
            type="button"
            aria-label={`Clear ${activeConfig.label} mode`}
            onClick={handleClearActive}
            className={cn(
              'inline-flex items-center justify-center h-8 w-8 mr-1 rounded-full transition-colors cursor-pointer ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              styles.close
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </PillPresence>
      <ModeDropdownContent onSelect={handleSelect} />
    </DropdownMenu>
  )
}

function ModeDropdownContent({
  onSelect
}: {
  onSelect: (mode: UserMode) => void
}) {
  return (
    <DropdownMenuContent
      align="start"
      className="w-64 max-w-[calc(100vw-2rem)]"
      sideOffset={5}
    >
      {SEARCH_MODE_CONFIGS.map(config => {
        const ModeIcon = config.icon
        return (
          <DropdownMenuItem
            key={config.value}
            onClick={() => onSelect(config.value)}
            className="flex items-start gap-2.5 py-2 px-2.5 cursor-pointer focus:outline-none"
          >
            <ModeIcon className={cn('h-4 w-4 mt-0.5 shrink-0', config.color)} />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium leading-none">
                {config.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {config.description}
              </span>
            </div>
          </DropdownMenuItem>
        )
      })}
    </DropdownMenuContent>
  )
}
