'use client'

import { useEffect, useRef } from 'react'

import { Activity, Minimize2 } from 'lucide-react'

import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TooltipButton } from '@/components/ui/tooltip-button'

import { Citation } from '@/components/tool-ui/citation/citation'
import type { SerializableCitation } from '@/components/tool-ui/citation/schema'
import { LinkPreview } from '@/components/tool-ui/link-preview/link-preview'
import type { SerializableLinkPreview } from '@/components/tool-ui/link-preview/schema'

import type { ActivityItem } from './activity-context'
import { useActivity } from './activity-context'
import { ActivityFetchItem } from './activity-fetch-item'
import { ActivitySearchItem } from './activity-search-item'

export function ActivityPanel() {
  const { state, close } = useActivity()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new items arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.items.length])

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col overflow-hidden bg-muted md:px-4 md:pt-14 md:pb-4">
        <div className="flex flex-col h-full bg-background rounded-xl md:border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2">
            <h3 className="flex items-center gap-2">
              <div className="p-2 rounded-md flex items-center gap-2">
                <Activity size={18} />
              </div>
              <span className="text-sm font-medium">Research Activity</span>
            </h3>
            <TooltipButton
              variant="ghost"
              size="icon"
              onClick={close}
              aria-label="Close panel"
              tooltipContent="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </TooltipButton>
          </div>
          <Separator className="my-1 bg-border/50" />
          <div data-vaul-no-drag className="flex-1 overflow-y-auto px-2 py-2">
            {state.items.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                Activity will appear here during research
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {state.items.map(item => (
                  <ActivityItemRenderer key={item.id} item={item} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

function ActivityItemRenderer({ item }: { item: ActivityItem }) {
  switch (item.type) {
    case 'search':
      return <ActivitySearchItem tool={item.data} />
    case 'fetch':
      return <ActivityFetchItem tool={item.data} />
    case 'mode-indicator':
      return (
        <div className="py-1 px-2 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">
          {item.data?.label || 'Research'}
        </div>
      )
    case 'link-preview': {
      const preview = item.data as SerializableLinkPreview
      return (
        <div className="px-1 py-0.5">
          <LinkPreview {...preview} className="text-xs" />
        </div>
      )
    }
    case 'citation': {
      const citation = item.data as SerializableCitation
      return (
        <div className="px-1 py-0.5">
          <Citation {...citation} variant="inline" />
        </div>
      )
    }
    default:
      return null
  }
}
