'use client'

import { useMemo, useState } from 'react'

import { Check, Code2, Copy, Download, FileText, Table2 } from 'lucide-react'

import { Button, cn } from './_adapter'
import type { SerializableAgentArtifact } from './schema'

const artifactIcons = {
  code: Code2,
  table: Table2,
  document: FileText,
  chart: Code2
}

type ParsedTable = {
  headers: string[]
  body: string[][]
}

function splitMarkdownTableRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim())
}

function isMarkdownTableSeparator(row: string) {
  const cells = splitMarkdownTableRow(row)

  return (
    cells.length > 1 &&
    cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
  )
}

function findNextNonBlankLineIndex(lines: string[], startIndex: number) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index]) return index
  }

  return -1
}

function parseMarkdownTable(content: string): ParsedTable | null {
  const lines = content.split('\n').map(line => line.trim())

  for (let index = 0; index < lines.length; index += 1) {
    const headerLine = lines[index]
    if (!headerLine?.includes('|')) continue

    const headers = splitMarkdownTableRow(headerLine)
    if (headers.length < 2) continue

    const separatorIndex = findNextNonBlankLineIndex(lines, index)
    if (
      separatorIndex === -1 ||
      !isMarkdownTableSeparator(lines[separatorIndex] ?? '')
    ) {
      continue
    }

    const body: string[][] = []
    for (const line of lines.slice(separatorIndex + 1)) {
      if (!line) {
        if (body.length > 0) break
        continue
      }

      if (!line.includes('|')) {
        if (body.length > 0) break
        continue
      }

      const cells = splitMarkdownTableRow(line)
      if (cells.length < 2) {
        if (body.length > 0) break
        continue
      }

      body.push(cells)
    }

    return { headers, body }
  }

  return null
}

// Naive CSV parser: splits on bare commas and does not handle quoted fields
// (e.g. values containing commas or newlines). The Markdown-table parser runs
// first (parseMarkdownTable), so this path is only reached for raw CSV input.
// If quoted-field CSV support is needed, replace with a proper CSV library.
function parseCsvTable(content: string): ParsedTable | null {
  const rows = content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(row => row.split(',').map(cell => cell.trim()))

  const headers = rows[0] ?? []
  if (headers.length < 2) return null

  return {
    headers,
    body: rows.slice(1)
  }
}

function parseTable(content: string) {
  return parseMarkdownTable(content) ?? parseCsvTable(content)
}

function getDownloadFilename(
  title: string,
  artifactType: string,
  language?: string
) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const extension =
    artifactType === 'table'
      ? 'csv'
      : artifactType === 'document'
        ? 'md'
        : language === 'typescript'
          ? 'ts'
          : 'txt'

  return `${slug || 'artifact'}.${extension}`
}

export function AgentArtifact({
  id,
  title,
  artifactType,
  content,
  language,
  versions,
  currentVersion,
  metadata
}: SerializableAgentArtifact) {
  const [tab, setTab] = useState<'preview' | 'code' | 'raw'>('preview')
  const [copied, setCopied] = useState(false)
  const [selectedVersionOverride, setSelectedVersionOverride] = useState<
    string | undefined
  >()
  const defaultVersionId = currentVersion ?? versions?.[versions.length - 1]?.id
  const selectedVersionId = versions?.some(
    version => version.id === selectedVersionOverride
  )
    ? selectedVersionOverride
    : defaultVersionId

  const activeContent = useMemo(() => {
    if (!versions?.length || !selectedVersionId) return content
    return (
      versions.find(version => version.id === selectedVersionId)?.content ??
      content
    )
  }, [content, selectedVersionId, versions])
  const activeVersion = useMemo(
    () => versions?.find(version => version.id === selectedVersionId),
    [selectedVersionId, versions]
  )
  const versionLabel = activeVersion?.label ?? currentVersion

  const downloadHref = useMemo(
    () => `data:text/plain;charset=utf-8,${encodeURIComponent(activeContent)}`,
    [activeContent]
  )
  const downloadFilename = useMemo(
    () => getDownloadFilename(title, artifactType, language),
    [artifactType, language, title]
  )
  const Icon = artifactIcons[artifactType]

  function copyContent() {
    const clipboard = navigator.clipboard
    if (!clipboard?.writeText) return

    void Promise.resolve(clipboard.writeText(activeContent))
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {
        setCopied(false)
      })
  }

  const table = artifactType === 'table' ? parseTable(activeContent) : null

  return (
    <section
      className="overflow-hidden rounded-lg border bg-background text-sm shadow-sm"
      data-tool-ui-id={id}
      data-slot="agent-artifact"
    >
      <header className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h3 className="truncate font-medium">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {language ?? artifactType}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Download artifact content"
          >
            <a href={downloadHref} download={downloadFilename}>
              <Download className="size-4" />
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={copyContent}
            aria-label={
              copied ? 'Copied artifact content' : 'Copy artifact content'
            }
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>
      </header>

      <div className="flex border-b bg-muted/40 px-2 pt-2">
        {(['preview', 'code', 'raw'] as const).map(nextTab => (
          <button
            key={nextTab}
            type="button"
            className={cn(
              'rounded-t-md px-3 py-1.5 text-xs font-medium capitalize',
              tab === nextTab
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setTab(nextTab)}
          >
            {nextTab}
          </button>
        ))}
      </div>

      <div className="max-h-[420px] overflow-auto p-3">
        {tab === 'preview' && table ? (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                {table.headers.map(header => (
                  <th key={header} className="border-b px-2 py-1 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.body.map((row, rowIndex) => (
                <tr key={`${id}-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${id}-cell-${rowIndex}-${cellIndex}`}
                      className="border-b px-2 py-1 text-muted-foreground"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs">
            {activeContent}
          </pre>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        {versions?.length ? (
          <div className="flex flex-wrap items-center gap-1">
            {versions.map(version => {
              const isActive = version.id === selectedVersionId

              return (
                <button
                  key={version.id}
                  type="button"
                  aria-label={
                    isActive
                      ? `Current version ${version.label}`
                      : `Show ${version.label}`
                  }
                  aria-pressed={isActive}
                  className={cn(
                    'rounded px-1.5 py-0.5 font-medium transition-colors',
                    isActive
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  onClick={() => setSelectedVersionOverride(version.id)}
                >
                  {version.label}
                </button>
              )
            })}
          </div>
        ) : versionLabel ? (
          <span>{versionLabel}</span>
        ) : null}
        {metadata?.model ? <span>{metadata.model}</span> : null}
        {typeof metadata?.tokens === 'number' ? (
          <span>{metadata.tokens.toLocaleString()} tokens</span>
        ) : null}
        {metadata?.size ? <span>{metadata.size}</span> : null}
        {metadata?.generationTime ? (
          <span>{metadata.generationTime}</span>
        ) : null}
      </footer>
    </section>
  )
}
