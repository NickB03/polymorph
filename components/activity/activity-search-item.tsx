'use client'

import { AlertCircle, Loader2, Search as SearchIcon } from 'lucide-react'

import type { SearchResults } from '@/lib/types'
import type { ToolPart } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import { SourceFavicons } from '@/components/source-favicons'

interface ActivitySearchItemProps {
  tool: ToolPart<'search'>
}

export function ActivitySearchItem({ tool }: ActivitySearchItemProps) {
  const isActive =
    tool.state === 'input-streaming' || tool.state === 'input-available'
  const isError = tool.state === 'output-error'

  const output = tool.state === 'output-available' ? tool.output : undefined
  const isSearching = output?.state === 'searching'
  const searchResults: SearchResults | undefined =
    output?.state === 'complete' ? output : undefined

  const query = tool.input?.query || output?.query || ''
  const totalResults =
    (searchResults?.results?.length || 0) +
    (searchResults?.videos?.length || 0) +
    (searchResults?.images?.length || 0)

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1 px-2 rounded text-xs text-muted-foreground',
        'hover:bg-accent/50 transition-colors'
      )}
    >
      <SearchIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate min-w-0 flex-1">{query}</span>

      {isActive || isSearching ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
      ) : isError ? (
        <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
      ) : searchResults ? (
        <div className="flex items-center gap-1.5 shrink-0">
          {totalResults > 0 && (
            <span className="text-[10px] tabular-nums">{totalResults}</span>
          )}
          {searchResults.results && searchResults.results.length > 0 && (
            <SourceFavicons results={searchResults.results} maxDisplay={3} />
          )}
        </div>
      ) : null}
    </div>
  )
}
