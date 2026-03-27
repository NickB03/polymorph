'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'

import { injectViewportFitStyles } from '@/lib/canvas/inject-viewport-fit'
import type { CanvasArtifactState } from '@/lib/canvas/service'
import type { CanvasDiagnostic } from '@/lib/types/canvas'

import { useCanvas } from './canvas-context'

// ── Constants ─────────────────────────────────────────────────────────

const CHANNEL = 'canvas-preview'

/** Message types that the host sends to the preview iframe */
export type HostToPreviewType = 'init'

/** Message types that the preview iframe sends back to the host */
export type PreviewToHostType =
  | 'preview-ready'
  | 'runtime-error'
  | 'unhandled-rejection'
  | 'asset-error'
  | 'external-request-error'
  | 'height-change'

/** The locked postMessage envelope shape */
export type CanvasPreviewEnvelope = {
  channel: typeof CHANNEL
  type: HostToPreviewType | PreviewToHostType
  artifactId: string
  revisionId: string
  nonce: string
  parentOrigin?: string
  requestId?: string
  payload?: unknown
}

// ── Runtime diagnostic message types ─────────────────────────────────

const RUNTIME_DIAGNOSTIC_TYPES = new Set<PreviewToHostType>([
  'runtime-error',
  'unhandled-rejection',
  'asset-error',
  'external-request-error'
])

// ── Helpers ──────────────────────────────────────────────────────────

function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function toDiagnostic(
  type: PreviewToHostType,
  payload: Record<string, unknown> | null | undefined
): CanvasDiagnostic {
  const message = (payload?.message as string) || `${type}: unknown error`

  return {
    severity: 'error',
    message,
    file: (payload?.filename as string) || undefined,
    line: (payload?.lineno as number) || undefined,
    column: (payload?.colno as number) || undefined
  }
}

// ── Component ────────────────────────────────────────────────────────

export function CanvasPreview() {
  const canvas = useCanvas()
  const { artifact, guestCanvasToken, setArtifact } = canvas
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const nonceRef = useRef(generateNonce())

  // Rotate nonce when draftCompiledHtml changes
  const prevHtmlRef = useRef(artifact?.draftCompiledHtml)
  if (artifact?.draftCompiledHtml !== prevHtmlRef.current) {
    prevHtmlRef.current = artifact?.draftCompiledHtml
    nonceRef.current = generateNonce()
  }

  // ── Post runtime diagnostics to the server ─────────────────────

  const postRuntimeDiagnostics = useCallback(
    async (
      artifactId: string,
      draftRevision: number,
      diagnostics: CanvasDiagnostic[]
    ) => {
      try {
        const body: Record<string, unknown> = {
          draftRevision,
          diagnostics
        }
        if (guestCanvasToken) {
          body.guestCanvasToken = guestCanvasToken
        }

        const res = await fetch(
          `/api/canvas-artifacts/${artifactId}/runtime-diagnostics`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }
        )

        if (!res.ok) return

        const state: CanvasArtifactState = await res.json()
        setArtifact(state)
      } catch {
        // Silently ignore — diagnostics are best-effort
      }
    },
    [guestCanvasToken, setArtifact]
  )

  // ── Send init message to the iframe on load ────────────────────

  const handleIframeLoad = useCallback(() => {
    if (!iframeRef.current?.contentWindow || !artifact) return

    const initMessage: CanvasPreviewEnvelope = {
      channel: CHANNEL,
      type: 'init',
      artifactId: artifact.artifactId,
      revisionId: String(artifact.draftRevision),
      nonce: nonceRef.current,
      parentOrigin: window.location.origin
    }

    iframeRef.current.contentWindow.postMessage(initMessage, '*')
  }, [artifact])

  // ── Listen for messages from the iframe ────────────────────────

  useEffect(() => {
    if (!artifact) return

    const currentNonce = nonceRef.current
    const currentArtifactId = artifact.artifactId
    const currentDraftRevision = artifact.draftRevision
    const currentRevision = String(currentDraftRevision)

    function handleMessage(event: MessageEvent) {
      const data = event.data as CanvasPreviewEnvelope | undefined
      if (!data || data.channel !== CHANNEL) return

      // Validate source matches our iframe
      if (
        iframeRef.current &&
        event.source !== iframeRef.current.contentWindow
      ) {
        return
      }

      // Validate envelope fields — artifactId + event.source (above) are
      // sufficient to filter stale/cross-artifact messages. The compiled HTML
      // cannot know the final draftRevision or the client-generated nonce, so
      // those fields are not checked here.
      if (data.artifactId !== currentArtifactId) return

      const { type, payload } = data

      if (type === 'preview-ready') {
        // Preview mounted successfully — no action needed
        return
      }

      if (RUNTIME_DIAGNOSTIC_TYPES.has(type as PreviewToHostType)) {
        const diagnostic = toDiagnostic(
          type as PreviewToHostType,
          payload as Record<string, unknown> | null | undefined
        )
        postRuntimeDiagnostics(currentArtifactId, currentDraftRevision, [
          diagnostic
        ])
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [artifact, postRuntimeDiagnostics])

  // ── Render ─────────────────────────────────────────────────────

  const srcdoc = useMemo(
    () => injectViewportFitStyles(artifact?.draftCompiledHtml ?? ''),
    [artifact?.draftCompiledHtml]
  )

  if (!artifact) return null

  return (
    <iframe
      ref={iframeRef}
      title="Canvas preview"
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      onLoad={handleIframeLoad}
      className="h-full w-full border-0 overflow-hidden"
      data-testid="canvas-preview-iframe"
    />
  )
}
