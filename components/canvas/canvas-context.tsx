'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from 'react'

import type { CanvasArtifactState } from '@/lib/canvas/service'
import type { LegacyCanvasNotice } from '@/lib/types/canvas'

// ── Types ────────────────────────────────────────────────────────────

export type CanvasContextValue = {
  /** Currently focused artifact ID, or null */
  artifactId: string | null
  /** Loaded artifact state, or null */
  artifact: CanvasArtifactState | null
  /** Whether the artifact is currently being fetched */
  isLoading: boolean
  /** Whether the workspace panel should be open */
  isWorkspaceOpen: boolean
  /** Legacy notice to display instead of a live workspace */
  legacyNotice: LegacyCanvasNotice | null
  /** Guest token for unauthenticated artifact access */
  guestCanvasToken: string | null

  // ── Actions ──────────────────────────────────────────────────────

  /** Fetch and display an artifact by ID */
  openCanvasArtifact: (
    artifactId: string,
    guestToken?: string | null
  ) => Promise<void>
  /** Focus an already-loaded artifact (no re-fetch) */
  focusCanvasArtifact: (artifactId: string) => void
  /** Show a legacy notice for old artifact references */
  openLegacyCanvasNotice: (input: {
    artifactId: string
    source: 'chat-history' | 'public-link' | 'guest-token'
  }) => void
  /** Close the canvas workspace panel */
  closeWorkspace: () => void
  /** Entry point for "Ask AI to change it" */
  requestCanvasAiUpdate: (context: string) => void
  /** Re-fetch current artifact from the route */
  reloadArtifact: () => Promise<void>
  /** Set the guest canvas token */
  setGuestCanvasToken: (token: string | null) => void
  /** Replace artifact state directly (used by streaming updates) */
  setArtifact: (state: CanvasArtifactState | null) => void

  // ── Route-backed actions ─────────────────────────────────────────

  /** PATCH /api/canvas-artifacts/[artifactId]/draft */
  updateDraft: (
    source: Record<string, string>,
    baseRevision: number
  ) => Promise<CanvasArtifactState | null>
  /** POST /api/canvas-artifacts/[artifactId]/versions */
  saveVersion: () => Promise<CanvasArtifactState | null>
  /** POST /api/canvas-artifacts/[artifactId]/restore */
  restoreVersion: (versionId: string) => Promise<CanvasArtifactState | null>
  /** GET /api/canvas-artifacts/[artifactId]/export (triggers download) */
  exportHtml: () => Promise<void>
}

const CanvasContext = createContext<CanvasContextValue | null>(null)

// ── Helpers ──────────────────────────────────────────────────────────

function buildUrl(
  artifactId: string,
  path: string,
  guestToken: string | null
): string {
  const base = `/api/canvas-artifacts/${artifactId}${path}`
  if (guestToken) {
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}guestCanvasToken=${encodeURIComponent(guestToken)}`
  }
  return base
}

// ── Provider ─────────────────────────────────────────────────────────

export function CanvasProvider({ children }: { children: React.ReactNode }) {
  const [artifactId, setArtifactId] = useState<string | null>(null)
  const [artifact, setArtifact] = useState<CanvasArtifactState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [legacyNotice, setLegacyNotice] = useState<LegacyCanvasNotice | null>(
    null
  )
  const [guestCanvasToken, setGuestCanvasToken] = useState<string | null>(null)

  // Tracks the artifact ID currently being fetched to prevent concurrent
  // opens of the same artifact (the auto-open effect can fire repeatedly
  // during streaming as canvas state changes trigger re-renders).
  const openingRef = useRef<string | null>(null)

  const isWorkspaceOpen = !!(artifact || isLoading || legacyNotice)

  // ── Core actions ─────────────────────────────────────────────────

  const openCanvasArtifact = useCallback(
    async (id: string, guestToken?: string | null) => {
      if (!id) return // Guard against empty artifactId (e.g. from failed creates)
      if (openingRef.current === id) return // Already fetching this artifact

      openingRef.current = id
      setLegacyNotice(null)
      setArtifactId(id)
      setIsLoading(true)

      try {
        const effectiveGuestToken = guestToken ?? guestCanvasToken
        if (guestToken !== undefined) {
          setGuestCanvasToken(guestToken)
        }

        const url = buildUrl(id, '', effectiveGuestToken)
        const res = await fetch(url)
        if (!res.ok) {
          console.error('Failed to load canvas artifact:', res.status)
          setArtifact(null)
          return
        }
        const state: CanvasArtifactState = await res.json()
        setArtifact(state)
        if (state.guestCanvasToken) {
          setGuestCanvasToken(state.guestCanvasToken)
        }
      } catch (err) {
        console.error('Error loading canvas artifact:', err)
        setArtifact(null)
      } finally {
        if (openingRef.current === id) {
          openingRef.current = null
        }
        setIsLoading(false)
      }
    },
    [guestCanvasToken]
  )

  const focusCanvasArtifact = useCallback(
    (id: string) => {
      if (!id) return // Guard against empty artifactId

      if (artifact && artifact.artifactId === id) {
        // Already loaded, just ensure workspace is visible
        setLegacyNotice(null)
        return
      }
      // Already fetching this artifact — don't re-trigger
      if (openingRef.current === id) return

      // Not loaded yet, fall through to full open
      openCanvasArtifact(id)
    },
    [artifact, openCanvasArtifact]
  )

  const openLegacyCanvasNotice = useCallback(
    (input: {
      artifactId: string
      source: 'chat-history' | 'public-link' | 'guest-token'
    }) => {
      setArtifact(null)
      setArtifactId(input.artifactId)
      setIsLoading(false)
      setLegacyNotice({
        kind: 'legacy-unavailable',
        artifactId: input.artifactId,
        source: input.source
      })
    },
    []
  )

  const closeWorkspace = useCallback(() => {
    setArtifact(null)
    setArtifactId(null)
    setIsLoading(false)
    setLegacyNotice(null)
  }, [])

  const requestCanvasAiUpdate = useCallback((_context: string) => {
    // Placeholder for Task 11 — will wire to the chat input
  }, [])

  const reloadArtifact = useCallback(async () => {
    if (!artifactId) return

    setIsLoading(true)
    try {
      const url = buildUrl(artifactId, '', guestCanvasToken)
      const res = await fetch(url)
      if (!res.ok) {
        console.error('Failed to reload canvas artifact:', res.status)
        return
      }
      const state: CanvasArtifactState = await res.json()
      setArtifact(state)
      if (state.guestCanvasToken) {
        setGuestCanvasToken(state.guestCanvasToken)
      }
    } catch (err) {
      console.error('Error reloading canvas artifact:', err)
    } finally {
      setIsLoading(false)
    }
  }, [artifactId, guestCanvasToken])

  // ── Route-backed actions ─────────────────────────────────────────

  const updateDraft = useCallback(
    async (
      source: Record<string, string>,
      baseRevision: number
    ): Promise<CanvasArtifactState | null> => {
      if (!artifactId) return null

      const url = buildUrl(artifactId, '/draft', null)
      const body: Record<string, unknown> = {
        baseRevision,
        draftSource: source
      }
      if (guestCanvasToken) {
        body.guestCanvasToken = guestCanvasToken
      }

      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.status === 409) {
        // Stale revision — caller handles conflict UI
        return null
      }

      if (!res.ok) {
        console.error('Draft update failed:', res.status)
        return null
      }

      const state: CanvasArtifactState = await res.json()
      setArtifact(state)
      if (state.guestCanvasToken) {
        setGuestCanvasToken(state.guestCanvasToken)
      }
      return state
    },
    [artifactId, guestCanvasToken]
  )

  const saveVersion =
    useCallback(async (): Promise<CanvasArtifactState | null> => {
      if (!artifactId) return null

      const url = buildUrl(artifactId, '/versions', null)
      const body: Record<string, unknown> = {}
      if (guestCanvasToken) {
        body.guestCanvasToken = guestCanvasToken
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        console.error('Version save failed:', res.status)
        return null
      }

      const state: CanvasArtifactState = await res.json()
      setArtifact(state)
      if (state.guestCanvasToken) {
        setGuestCanvasToken(state.guestCanvasToken)
      }
      return state
    }, [artifactId, guestCanvasToken])

  const restoreVersion = useCallback(
    async (versionId: string): Promise<CanvasArtifactState | null> => {
      if (!artifactId || !artifact) return null

      const url = buildUrl(artifactId, '/restore', null)
      const body: Record<string, unknown> = {
        versionId,
        baseRevision: artifact.draftRevision
      }
      if (guestCanvasToken) {
        body.guestCanvasToken = guestCanvasToken
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        console.error('Version restore failed:', res.status)
        return null
      }

      const state: CanvasArtifactState = await res.json()
      setArtifact(state)
      if (state.guestCanvasToken) {
        setGuestCanvasToken(state.guestCanvasToken)
      }
      return state
    },
    [artifactId, artifact, guestCanvasToken]
  )

  const exportHtml = useCallback(async () => {
    if (!artifactId) return

    const url = buildUrl(artifactId, '/export', guestCanvasToken)

    try {
      const res = await fetch(url)
      if (!res.ok) {
        console.error('Export failed:', res.status)
        return
      }

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      const filename = filenameMatch?.[1] ?? 'canvas-artifact.html'

      const anchor = document.createElement('a')
      anchor.href = URL.createObjectURL(blob)
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(anchor.href)
    } catch (err) {
      console.error('Export error:', err)
    }
  }, [artifactId, guestCanvasToken])

  // ── Render ───────────────────────────────────────────────────────

  const value = useMemo<CanvasContextValue>(
    () => ({
      artifactId,
      artifact,
      isLoading,
      isWorkspaceOpen,
      legacyNotice,
      guestCanvasToken,
      openCanvasArtifact,
      focusCanvasArtifact,
      openLegacyCanvasNotice,
      closeWorkspace,
      requestCanvasAiUpdate,
      reloadArtifact,
      setGuestCanvasToken,
      setArtifact,
      updateDraft,
      saveVersion,
      restoreVersion,
      exportHtml
    }),
    [
      artifactId,
      artifact,
      isLoading,
      isWorkspaceOpen,
      legacyNotice,
      guestCanvasToken,
      openCanvasArtifact,
      focusCanvasArtifact,
      openLegacyCanvasNotice,
      closeWorkspace,
      requestCanvasAiUpdate,
      reloadArtifact,
      setGuestCanvasToken,
      setArtifact,
      updateDraft,
      saveVersion,
      restoreVersion,
      exportHtml
    ]
  )

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  )
}

export function useCanvas() {
  const value = useContext(CanvasContext)

  if (!value) {
    throw new Error('useCanvas must be used within CanvasProvider')
  }

  return value
}
