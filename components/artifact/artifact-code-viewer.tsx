'use client'

import { useState } from 'react'

import { FileCode } from 'lucide-react'

import type { ArtifactSourceFile } from '@/lib/types/artifact'
import { cn } from '@/lib/utils'

import { useArtifact } from './artifact-context'

function basename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function LineNumbers({ count }: { count: number }) {
  return (
    <div
      aria-hidden
      className="select-none text-right pr-3 text-muted-foreground/50 leading-5"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{i + 1}</div>
      ))}
    </div>
  )
}

function FileContent({ file }: { file: ArtifactSourceFile }) {
  const lines = file.content.split('\n')

  return (
    <div className="flex font-mono text-[12px] py-3 overflow-auto h-full">
      <LineNumbers count={lines.length} />
      <pre className="flex-1 overflow-x-auto pr-4">
        <code className="leading-5 block">{file.content}</code>
      </pre>
    </div>
  )
}

export function ArtifactCodeViewer() {
  const { state } = useArtifact()
  const { sourceFiles } = state.workspace
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (sourceFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center">
        <FileCode className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">
          No source files available
        </p>
      </div>
    )
  }

  const safeIndex = Math.min(selectedIndex, sourceFiles.length - 1)
  const selectedFile = sourceFiles[safeIndex]

  return (
    <div className="flex flex-col h-full">
      {/* File tabs */}
      <div className="flex items-center gap-0 border-b overflow-x-auto shrink-0 bg-muted/30">
        {sourceFiles.map((file, i) => (
          <button
            key={file.path}
            onClick={() => setSelectedIndex(i)}
            className={cn(
              'px-3 py-1.5 text-[11px] font-mono whitespace-nowrap border-b-2 transition-colors',
              i === safeIndex
                ? 'border-foreground text-foreground bg-background'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {basename(file.path)}
          </button>
        ))}
      </div>

      {/* File path breadcrumb */}
      <div className="px-3 py-1 text-[10px] text-muted-foreground font-mono bg-muted/20 border-b shrink-0">
        {selectedFile.path}
      </div>

      {/* File content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <FileContent file={selectedFile} />
      </div>
    </div>
  )
}
