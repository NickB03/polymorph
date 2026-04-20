'use client'

import { memo, useState } from 'react'

import { ChevronDown, ChevronUp, FileCode2 } from 'lucide-react'

import { cn } from './_adapter'
import type { CodeBlockProps } from './schema'

function splitCodeLines(code: string) {
  const lines = code.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines.length > 0 ? lines : ['']
}

export const CodeBlock = memo(function CodeBlock({
  id,
  code,
  language,
  filename,
  lineNumbers = true,
  highlightLines,
  maxCollapsedLines,
  className
}: CodeBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const lines = splitCodeLines(code)
  const highlightSet = new Set(highlightLines ?? [])
  const shouldCollapse =
    typeof maxCollapsedLines === 'number' && lines.length > maxCollapsedLines
  const visibleLines =
    shouldCollapse && !expanded ? lines.slice(0, maxCollapsedLines) : lines

  return (
    <section
      data-tool-ui-id={id}
      data-slot="code-block"
      className={cn(
        'w-full overflow-hidden rounded-2xl border border-border bg-card',
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/80 bg-muted/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {filename ?? 'Code snippet'}
            </p>
            {(language || shouldCollapse) && (
              <p className="truncate text-xs text-muted-foreground">
                {language ?? 'plain text'}
                {shouldCollapse ? ` - ${lines.length} lines` : ''}
              </p>
            )}
          </div>
        </div>
        {shouldCollapse && (
          <button
            type="button"
            onClick={() => setExpanded(current => !current)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3.5" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" />
                Show all
              </>
            )}
          </button>
        )}
      </header>

      <div className="overflow-x-auto bg-slate-950 text-slate-100">
        <pre className="min-w-full p-0 text-[13px] leading-6">
          <code>
            {visibleLines.map((line, index) => {
              const lineNumber = index + 1
              const isHighlighted = highlightSet.has(lineNumber)

              return (
                <div
                  key={`${id}-line-${lineNumber}`}
                  className={cn(
                    'grid min-w-full grid-cols-[auto_1fr] gap-4 px-4',
                    !lineNumbers && 'grid-cols-[1fr]',
                    isHighlighted && 'bg-sky-500/15'
                  )}
                >
                  {lineNumbers && (
                    <span className="select-none py-0.5 text-right text-xs tabular-nums text-slate-500">
                      {lineNumber}
                    </span>
                  )}
                  <span className="overflow-x-visible py-0.5 whitespace-pre">
                    {line || ' '}
                  </span>
                </div>
              )
            })}
          </code>
        </pre>
      </div>
    </section>
  )
})
