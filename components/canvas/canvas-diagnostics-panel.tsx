'use client'

import { useState } from 'react'

import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react'

import type {
  CanvasDiagnostic,
  CanvasDiagnostics,
  CanvasDiagnosticSeverity
} from '@/lib/types/canvas'
import { cn } from '@/lib/utils'

import { useCanvas } from './canvas-context'

// ── Severity helpers ─────────────────────────────────────────────────

const SEVERITY_ICON: Record<
  CanvasDiagnosticSeverity,
  React.ComponentType<{ className?: string }>
> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
}

const SEVERITY_COLOR: Record<CanvasDiagnosticSeverity, string> = {
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info'
}

// ── Diagnostic item ──────────────────────────────────────────────────

function DiagnosticItem({ diagnostic }: { diagnostic: CanvasDiagnostic }) {
  const Icon = SEVERITY_ICON[diagnostic.severity]
  const color = SEVERITY_COLOR[diagnostic.severity]

  return (
    <div
      className="flex items-start gap-2 px-3 py-1.5 text-xs"
      data-testid="canvas-diagnostic-item"
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', color)} />
      <div className="min-w-0 flex-1">
        <p className="break-words">{diagnostic.message}</p>
        {(diagnostic.file || diagnostic.line != null) && (
          <p className="text-muted-foreground mt-0.5">
            {diagnostic.file && <span>{diagnostic.file}</span>}
            {diagnostic.line != null && <span>:{diagnostic.line}</span>}
            {diagnostic.column != null && <span>:{diagnostic.column}</span>}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Collapsible section ──────────────────────────────────────────────

function DiagnosticSection({
  title,
  diagnostics,
  defaultOpen = false
}: {
  title: string
  diagnostics: CanvasDiagnostic[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  if (diagnostics.length === 0) return null

  const hasErrors = diagnostics.some(d => d.severity === 'error')
  const hasWarnings = diagnostics.some(d => d.severity === 'warning')

  return (
    <div data-testid={`canvas-diagnostics-section-${title.toLowerCase()}`}>
      <button
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium hover:bg-accent/50 transition-colors"
        onClick={() => setOpen(!open)}
        data-testid={`canvas-diagnostics-toggle-${title.toLowerCase()}`}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span>{title}</span>
        <span
          className={cn(
            'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            hasErrors
              ? 'bg-error-bg text-error'
              : hasWarnings
                ? 'bg-warning-bg text-warning'
                : 'bg-info-bg text-info'
          )}
        >
          {diagnostics.length}
        </span>
      </button>
      {open && (
        <div className="border-b">
          {diagnostics.map((d, i) => (
            <DiagnosticItem key={`${d.file}-${d.line}-${i}`} diagnostic={d} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Diagnostics panel ────────────────────────────────────────────────

function hasDiagnostics(diag: CanvasDiagnostics | null): boolean {
  if (!diag) return false
  return (
    diag.validation.length > 0 ||
    diag.compile.length > 0 ||
    diag.runtime.length > 0
  )
}

export function CanvasDiagnosticsPanel() {
  const canvas = useCanvas()
  const artifact = canvas.artifact

  if (!artifact) return null

  const diagnostics = artifact.draftDiagnostics

  if (!hasDiagnostics(diagnostics)) {
    return (
      <div
        className="flex h-full items-center justify-center text-sm text-muted-foreground"
        data-testid="canvas-diagnostics-empty"
      >
        No diagnostics
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col overflow-auto"
      data-testid="canvas-diagnostics-panel"
    >
      <DiagnosticSection
        title="Validation"
        diagnostics={diagnostics!.validation}
        defaultOpen
      />
      <DiagnosticSection
        title="Compile"
        diagnostics={diagnostics!.compile}
        defaultOpen
      />
      <DiagnosticSection
        title="Runtime"
        diagnostics={diagnostics!.runtime}
        defaultOpen
      />
    </div>
  )
}
