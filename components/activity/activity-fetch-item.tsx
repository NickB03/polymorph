'use client'

import { AlertCircle, Check, Globe } from 'lucide-react'

import type { SearchResults as SearchResultsType } from '@/lib/types'
import type { ToolPart } from '@/lib/types/ai'
import { cn } from '@/lib/utils'
import { getDomain } from '@/lib/utils/domain'

interface ActivityFetchItemProps {
  tool: ToolPart<'fetch'>
}

export function ActivityFetchItem({ tool }: ActivityFetchItemProps) {
  const url = tool.input?.url
  const domain = url ? getDomain(url) : null

  const isActive =
    tool.state === 'input-streaming' || tool.state === 'input-available'
  const isError = tool.state === 'output-error'

  const output = tool.state === 'output-available' ? tool.output : undefined
  const isFetching = output?.state === 'fetching'
  const fetchResults = output?.state === 'complete' ? output : undefined

  let contentLength: number | undefined
  if (fetchResults) {
    const data = fetchResults as SearchResultsType
    contentLength = data?.results?.[0]?.content?.length
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1 px-2 rounded text-xs text-muted-foreground',
        'hover:bg-accent/50 transition-colors'
      )}
    >
      <Globe className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate min-w-0 flex-1">
        {domain || url || 'Unknown URL'}
      </span>

      {isActive || isFetching ? (
        <span className="shrink-0 animate-pulse text-[10px]">
          Retrieving...
        </span>
      ) : isError ? (
        <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
      ) : fetchResults ? (
        <div className="flex items-center gap-1 shrink-0">
          <Check className="h-3 w-3 text-green-500" />
          {contentLength != null && (
            <span className="text-[10px] tabular-nums">
              {contentLength > 1000
                ? `${Math.round(contentLength / 1000)}k`
                : contentLength}
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}
