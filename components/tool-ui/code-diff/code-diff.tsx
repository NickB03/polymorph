'use client'

import { memo, useState } from 'react'

import { ChevronDown, ChevronUp, FileDiff } from 'lucide-react'

import { cn } from './_adapter'
import type { CodeDiffProps } from './schema'

type DiffOperation =
  | {
      type: 'context'
      line: string
      oldLineNumber: number
      newLineNumber: number
    }
  | {
      type: 'delete'
      line: string
      oldLineNumber: number
    }
  | {
      type: 'add'
      line: string
      newLineNumber: number
    }

type SplitDiffRow = {
  left?: Extract<DiffOperation, { type: 'context' | 'delete' }>
  right?: Extract<DiffOperation, { type: 'context' | 'add' }>
}

function splitCodeLines(code: string) {
  const lines = code.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines.length > 0 ? lines : ['']
}

function buildDiffOperations(
  oldCode: string,
  newCode: string
): DiffOperation[] {
  const oldLines = splitCodeLines(oldCode)
  const newLines = splitCodeLines(newCode)
  const dp = Array.from({ length: oldLines.length + 1 }, () =>
    Array<number>(newLines.length + 1).fill(0)
  )

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex--) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex--) {
      if (oldLines[oldIndex] === newLines[newIndex]) {
        dp[oldIndex][newIndex] = dp[oldIndex + 1][newIndex + 1] + 1
      } else {
        dp[oldIndex][newIndex] = Math.max(
          dp[oldIndex + 1][newIndex],
          dp[oldIndex][newIndex + 1]
        )
      }
    }
  }

  const operations: DiffOperation[] = []
  let oldIndex = 0
  let newIndex = 0
  let oldLineNumber = 1
  let newLineNumber = 1

  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      operations.push({
        type: 'context',
        line: oldLines[oldIndex],
        oldLineNumber,
        newLineNumber
      })
      oldIndex++
      newIndex++
      oldLineNumber++
      newLineNumber++
      continue
    }

    if (dp[oldIndex + 1][newIndex] >= dp[oldIndex][newIndex + 1]) {
      operations.push({
        type: 'delete',
        line: oldLines[oldIndex],
        oldLineNumber
      })
      oldIndex++
      oldLineNumber++
    } else {
      operations.push({
        type: 'add',
        line: newLines[newIndex],
        newLineNumber
      })
      newIndex++
      newLineNumber++
    }
  }

  while (oldIndex < oldLines.length) {
    operations.push({
      type: 'delete',
      line: oldLines[oldIndex],
      oldLineNumber
    })
    oldIndex++
    oldLineNumber++
  }

  while (newIndex < newLines.length) {
    operations.push({
      type: 'add',
      line: newLines[newIndex],
      newLineNumber
    })
    newIndex++
    newLineNumber++
  }

  return operations
}

function buildSplitDiffRows(operations: DiffOperation[]) {
  const rows: SplitDiffRow[] = []

  for (let index = 0; index < operations.length; ) {
    const operation = operations[index]

    if (operation.type === 'context') {
      rows.push({
        left: operation,
        right: operation
      })
      index++
      continue
    }

    const deletions: Extract<DiffOperation, { type: 'delete' }>[] = []
    const additions: Extract<DiffOperation, { type: 'add' }>[] = []

    while (index < operations.length && operations[index].type !== 'context') {
      const candidate = operations[index]
      if (candidate.type === 'delete') {
        deletions.push(candidate)
      } else if (candidate.type === 'add') {
        additions.push(candidate)
      }
      index++
    }

    const rowCount = Math.max(deletions.length, additions.length)
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      rows.push({
        left: deletions[rowIndex],
        right: additions[rowIndex]
      })
    }
  }

  return rows
}

function getUnifiedRowClassName(type: DiffOperation['type']) {
  if (type === 'add') return 'bg-emerald-500/10'
  if (type === 'delete') return 'bg-rose-500/10'
  return 'bg-transparent'
}

function getSplitCellClassName(type?: DiffOperation['type']) {
  if (type === 'add') return 'bg-emerald-500/10'
  if (type === 'delete') return 'bg-rose-500/10'
  return 'bg-transparent'
}

export const CodeDiff = memo(function CodeDiff({
  id,
  oldCode,
  newCode,
  language,
  filename,
  lineNumbers = true,
  diffStyle = 'side-by-side',
  maxCollapsedLines,
  className
}: CodeDiffProps) {
  const [expanded, setExpanded] = useState(false)
  const operations = buildDiffOperations(oldCode, newCode)
  const totalRows =
    diffStyle === 'unified'
      ? operations.length
      : buildSplitDiffRows(operations).length
  const shouldCollapse =
    typeof maxCollapsedLines === 'number' && totalRows > maxCollapsedLines

  const visibleOperations =
    shouldCollapse && !expanded
      ? operations.slice(0, maxCollapsedLines)
      : operations
  const visibleSplitRows = buildSplitDiffRows(visibleOperations)

  return (
    <section
      data-tool-ui-id={id}
      data-slot="code-diff"
      className={cn(
        'w-full overflow-hidden rounded-2xl border border-border bg-card',
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/80 bg-muted/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileDiff className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {filename ?? 'Code changes'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {language ?? 'plain text'} -{' '}
              {diffStyle === 'side-by-side' ? 'side by side' : 'unified'}
              {shouldCollapse ? ` - ${totalRows} rows` : ''}
            </p>
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
        {diffStyle === 'unified' ? (
          <table className="min-w-full border-separate border-spacing-0 text-[13px] leading-6">
            <tbody>
              {visibleOperations.map((operation, index) => (
                <tr
                  key={`${id}-unified-${index}`}
                  className={getUnifiedRowClassName(operation.type)}
                >
                  {lineNumbers && (
                    <>
                      <td className="w-12 px-3 text-right text-xs tabular-nums text-slate-500">
                        {'oldLineNumber' in operation
                          ? operation.oldLineNumber
                          : ''}
                      </td>
                      <td className="w-12 px-3 text-right text-xs tabular-nums text-slate-500">
                        {'newLineNumber' in operation
                          ? operation.newLineNumber
                          : ''}
                      </td>
                    </>
                  )}
                  <td className="w-8 px-3 text-center text-xs text-slate-400">
                    {operation.type === 'add'
                      ? '+'
                      : operation.type === 'delete'
                        ? '-'
                        : ' '}
                  </td>
                  <td className="px-4 py-0.5 whitespace-pre">
                    {operation.line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="min-w-full border-separate border-spacing-0 text-[13px] leading-6">
            <tbody>
              {visibleSplitRows.map((row, index) => (
                <tr key={`${id}-split-${index}`}>
                  {lineNumbers && (
                    <td className="w-12 px-3 text-right text-xs tabular-nums text-slate-500">
                      {row.left && 'oldLineNumber' in row.left
                        ? row.left.oldLineNumber
                        : ''}
                    </td>
                  )}
                  <td
                    className={cn(
                      'w-1/2 px-4 py-0.5 whitespace-pre border-r border-slate-800',
                      getSplitCellClassName(row.left?.type)
                    )}
                  >
                    {row.left?.line ?? ' '}
                  </td>
                  {lineNumbers && (
                    <td className="w-12 px-3 text-right text-xs tabular-nums text-slate-500">
                      {row.right && 'newLineNumber' in row.right
                        ? row.right.newLineNumber
                        : ''}
                    </td>
                  )}
                  <td
                    className={cn(
                      'w-1/2 px-4 py-0.5 whitespace-pre',
                      getSplitCellClassName(row.right?.type)
                    )}
                  >
                    {row.right?.line ?? ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
})
