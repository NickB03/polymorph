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

function parseTable(content: string) {
  const rows = content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(row => row.split(',').map(cell => cell.trim()))

  return {
    headers: rows[0] ?? [],
    body: rows.slice(1)
  }
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

  const activeContent = useMemo(() => {
    if (!versions?.length || !currentVersion) return content
    return (
      versions.find(version => version.id === currentVersion)?.content ??
      content
    )
  }, [content, currentVersion, versions])

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
    void navigator.clipboard?.writeText(activeContent)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
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
        {currentVersion ? <span>{currentVersion}</span> : null}
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
