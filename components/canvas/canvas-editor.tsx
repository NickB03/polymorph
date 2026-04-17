'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import CodeMirror from '@uiw/react-codemirror'
import {
  AlertTriangle,
  ClipboardCopy,
  Plus,
  RefreshCw,
  Sparkles
} from 'lucide-react'

import { CANVAS_ALLOWED_FILES } from '@/lib/canvas/constants'
import type {
  CanvasArtifactStatus,
  CanvasSourceFiles
} from '@/lib/types/canvas'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { useCanvas } from './canvas-context'

// ── Types ────────────────────────────────────────────────────────────

type CanvasFile = (typeof CANVAS_ALLOWED_FILES)[number]

type ConflictState = {
  kind: 'stale-conflict'
  localSource: CanvasSourceFiles
}

// ── Language extensions ──────────────────────────────────────────────

const tsxExtensions = [javascript({ jsx: true, typescript: true })]
const cssExtensions = [css()]
const jsonExtensions = [json()]

function getExtensionsForFile(file: CanvasFile) {
  if (file === 'styles.css') return cssExtensions
  if (file === 'meta.json') return jsonExtensions
  return tsxExtensions
}

// ── Helpers ──────────────────────────────────────────────────────────

function isReadOnly(status: CanvasArtifactStatus): boolean {
  return status === 'generating' || status === 'restoring'
}

const DEBOUNCE_MS = 500

// ── Component ────────────────────────────────────────────────────────

export function CanvasEditor() {
  const canvas = useCanvas()
  const artifact = canvas.artifact

  // ── Local editor state ────────────────────────────────────────────
  const [activeFile, setActiveFile] = useState<CanvasFile>('App.tsx')
  const [localSource, setLocalSource] = useState<CanvasSourceFiles>(
    () => artifact?.draftSource ?? {}
  )
  const [conflict, setConflict] = useState<ConflictState | null>(null)

  // ── Debounce + inflight tracking ──────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflightRef = useRef(false)
  const editSequenceRef = useRef(0)
  const requestSequenceRef = useRef(0)
  const pendingSaveRef = useRef(false)
  // Initialize ref trackers with `null` so react-hooks/immutability doesn't
  // tie them to the current render's artifact snapshot; the actual values
  // are written from the sync effect below.
  const serverRevisionRef = useRef<number | null>(null)

  // Mirror of `localSource` so the debounced save can read the latest value
  // without a stale closure. Initialised to an empty object (a literal so
  // react-hooks/immutability stays happy) and then kept in sync via the
  // effect + handlers below.
  const localSourceRef = useRef<CanvasSourceFiles>({})

  // Sync local source when artifact changes externally (load, AI update, restore)
  const prevArtifactIdRef = useRef<string | null>(null)
  const prevDraftRevisionRef = useRef<number | null>(null)

  useEffect(() => {
    if (!artifact) return

    // Full reload when artifact changes or server revision advances
    // beyond what we last acknowledged
    if (
      artifact.artifactId !== prevArtifactIdRef.current ||
      artifact.draftRevision > (prevDraftRevisionRef.current ?? 0)
    ) {
      // Only replace local source if no in-flight save and no pending edits
      if (!inflightRef.current && !pendingSaveRef.current) {
        setLocalSource(artifact.draftSource)
        setConflict(null)
      }
      serverRevisionRef.current = artifact.draftRevision
    }

    prevArtifactIdRef.current = artifact.artifactId
    prevDraftRevisionRef.current = artifact.draftRevision
  }, [artifact])

  // Commit-phase sync for `localSourceRef` — covers updates that don't go
  // through `handleChange`/`handleAddFile` (e.g. server-driven replacement
  // via `setLocalSource(result.draftSource)` inside `doSave`).
  useEffect(() => {
    localSourceRef.current = localSource
  }, [localSource])

  // ── Save logic ────────────────────────────────────────────────────

  const doSave = useCallback(
    async function doSaveInner(source: CanvasSourceFiles): Promise<void> {
      if (!artifact || inflightRef.current) {
        pendingSaveRef.current = true
        return
      }

      inflightRef.current = true
      pendingSaveRef.current = false
      const seqAtRequest = ++requestSequenceRef.current
      const baseRevision = serverRevisionRef.current ?? 0

      const result = await canvas.updateDraft(source, baseRevision)

      inflightRef.current = false

      if (!result) {
        // 409 or error — check if stale conflict
        setConflict({ kind: 'stale-conflict', localSource: source })
        return
      }

      // Update server snapshot
      serverRevisionRef.current = result.draftRevision

      // If local edits happened after this request started, keep local buffer dirty
      if (editSequenceRef.current > seqAtRequest) {
        // Newer local edits exist — schedule another save
        pendingSaveRef.current = true
      } else {
        // No newer edits — replace local source from server
        setLocalSource(result.draftSource)
      }

      // If there's a pending save, run it. The named function expression
      // `doSaveInner` lets us recurse without a forward reference to the
      // outer `doSave` binding.
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
        setTimeout(() => {
          void doSaveInner(localSourceRef.current)
        }, 0)
      }
    },
    [artifact, canvas]
  )

  const scheduleSave = useCallback(
    (source: CanvasSourceFiles) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        doSave(source)
      }, DEBOUNCE_MS)
    },
    [doSave]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // ── Editor change handler ─────────────────────────────────────────

  const handleChange = useCallback(
    (value: string) => {
      if (!artifact || isReadOnly(artifact.status)) return

      editSequenceRef.current++
      const updated = {
        ...localSourceRef.current,
        [activeFile]: value
      }
      localSourceRef.current = updated
      setLocalSource(updated)
      setConflict(null)
      scheduleSave(updated)
    },
    [artifact, activeFile, scheduleSave]
  )

  // ── Conflict recovery actions ─────────────────────────────────────

  const handleReloadDraft = useCallback(async () => {
    setConflict(null)
    await canvas.reloadArtifact()
  }, [canvas])

  const handleCopyLocal = useCallback(async () => {
    if (conflict) {
      await navigator.clipboard.writeText(
        JSON.stringify(conflict.localSource, null, 2)
      )
    }
  }, [conflict])

  // ── File tab management ───────────────────────────────────────────

  const existingFiles = useMemo(() => {
    return CANVAS_ALLOWED_FILES.filter(f => f in localSource) as CanvasFile[]
  }, [localSource])

  const addableFiles = useMemo(() => {
    return CANVAS_ALLOWED_FILES.filter(
      f => !(f in localSource) && f !== 'App.tsx'
    ) as CanvasFile[]
  }, [localSource])

  const handleAddFile = useCallback(
    (file: CanvasFile) => {
      const defaultContent =
        file === 'styles.css'
          ? ''
          : file === 'components.tsx'
            ? 'export {}\n'
            : file === 'meta.json'
              ? '{\n  "title": ""\n}\n'
              : ''

      editSequenceRef.current++
      const updated = {
        ...localSourceRef.current,
        [file]: defaultContent
      }
      localSourceRef.current = updated
      setLocalSource(updated)
      setActiveFile(file)
      scheduleSave(updated)
    },
    [scheduleSave]
  )

  // ── Render ────────────────────────────────────────────────────────

  // If the active file was removed from localSource, fall back to the first
  // existing file during render rather than via an effect (avoids an extra
  // commit round-trip and the set-state-in-effect warning).
  if (
    !(activeFile in localSource) &&
    existingFiles.length > 0 &&
    existingFiles[0] !== activeFile
  ) {
    setActiveFile(existingFiles[0])
  }

  if (!artifact) return null

  const readOnly = isReadOnly(artifact.status)
  const currentValue = localSource[activeFile] ?? ''

  return (
    <div className="flex h-full flex-col" data-testid="canvas-editor">
      {/* File tabs */}
      <div
        className="flex items-center border-b px-2 overflow-x-auto scrollbar-none"
        data-testid="canvas-file-tabs"
      >
        {existingFiles.map(file => (
          <button
            key={file}
            className={cn(
              'shrink-0 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap',
              activeFile === file
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveFile(file)}
            data-testid={`canvas-file-tab-${file}`}
          >
            {file}
          </button>
        ))}
        {addableFiles.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="px-2 py-2 text-muted-foreground hover:text-foreground shrink-0"
                data-testid="canvas-add-file"
                aria-label="Add file"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[140px]">
              {addableFiles.map(file => (
                <DropdownMenuItem
                  key={file}
                  className="text-xs"
                  onClick={() => handleAddFile(file)}
                  data-testid={`canvas-add-file-${file}`}
                >
                  {file}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Conflict warning */}
      {conflict && (
        <div
          className="flex flex-col gap-2 border-b bg-destructive/10 px-3 py-2"
          data-testid="canvas-conflict-warning"
        >
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Your draft is out of sync with the server. Choose a recovery
              action:
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReloadDraft}
              data-testid="canvas-conflict-reload"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Reload latest draft
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLocal}
              data-testid="canvas-conflict-copy"
            >
              <ClipboardCopy className="h-3.5 w-3.5 mr-1" />
              Copy local changes
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled
              title="AI-assisted editing coming soon"
              data-testid="canvas-conflict-ai"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Ask AI to reapply changes
            </Button>
          </div>
        </div>
      )}

      {/* CodeMirror editor */}
      <div className="flex-1 min-h-0 overflow-auto">
        <CodeMirror
          value={currentValue}
          onChange={handleChange}
          extensions={getExtensionsForFile(activeFile)}
          theme={oneDark}
          readOnly={readOnly}
          aria-readonly={readOnly ? 'true' : undefined}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true
          }}
          className="h-full text-sm"
          data-testid="canvas-codemirror"
        />
      </div>
    </div>
  )
}
