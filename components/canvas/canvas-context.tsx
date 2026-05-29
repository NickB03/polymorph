'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import type { CanvasArtifactState } from '@/lib/canvas/service'
import type { CanvasCompileProgressPayload } from '@/lib/types/canvas'

export type PendingCanvasWorkspace = {
  artifactId: string
  title: string
}

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
  /** Guest token for unauthenticated artifact access */
  guestCanvasToken: string | null
  /** Workspace shell state before the artifact row exists */
  pendingWorkspace: PendingCanvasWorkspace | null
  /** Live compile progress for the current artifact */
  compileProgress: CanvasCompileProgressPayload | null

  // ── Actions ──────────────────────────────────────────────────────

  /** Fetch and display an artifact by ID */
  openCanvasArtifact: (
    artifactId: string,
    guestToken?: string | null,
    chatId?: string | null
  ) => Promise<void>
  /** Focus an already-loaded artifact (no re-fetch) */
  focusCanvasArtifact: (artifactId: string, chatId?: string | null) => void
  /** Close the canvas workspace panel */
  closeWorkspace: () => void
  /** Entry point for "Ask AI to change it" */
  requestCanvasAiUpdate: (context: string) => void
  /** Re-fetch current artifact from the route */
  reloadArtifact: () => Promise<void>
  /** Set the guest canvas token */
  setGuestCanvasToken: (token: string | null) => void
  /** Open the workspace before the artifact has been persisted */
  setPendingWorkspace: (workspace: PendingCanvasWorkspace | null) => void
  /** Clear the pending workspace shell */
  clearPendingWorkspace: () => void
  /** Update compile progress */
  setCompileProgress: (progress: CanvasCompileProgressPayload | null) => void
  /** Clear compile progress */
  clearCompileProgress: () => void
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
  /** Open the artifact in a new browser tab (fullscreen view) */
  viewFullscreen: () => void
}

const CanvasContext = createContext<CanvasContextValue | null>(null)

// ── Helpers ──────────────────────────────────────────────────────────

function buildUrl(
  artifactId: string,
  path: string,
  guestToken: string | null,
  chatId?: string | null
): string {
  const base = `/api/canvas-artifacts/${artifactId}${path}`
  const params = new URLSearchParams()

  if (guestToken) {
    params.set('guestCanvasToken', guestToken)
  }

  if (chatId) {
    params.set('chatId', chatId)
  }

  const query = params.toString()
  return query ? `${base}?${query}` : base
}

// ── Provider ─────────────────────────────────────────────────────────

export function CanvasProvider({ children }: { children: React.ReactNode }) {
  const [artifactId, setArtifactId] = useState<string | null>(null)
  const [artifact, setArtifact] = useState<CanvasArtifactState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [guestCanvasToken, setGuestCanvasToken] = useState<string | null>(null)
  const [pendingWorkspace, setPendingWorkspaceState] =
    useState<PendingCanvasWorkspace | null>(null)
  const [compileProgress, setCompileProgressState] =
    useState<CanvasCompileProgressPayload | null>(null)

  // Ref mirror of guestCanvasToken so callbacks can read the latest value
  // without depending on it (avoids cascading callback recreation on every
  // token rotation). Synchronised in an effect because mutating refs during
  // render is disallowed under react-hooks/refs.
  const guestTokenRef = useRef(guestCanvasToken)
  useEffect(() => {
    guestTokenRef.current = guestCanvasToken
  }, [guestCanvasToken])

  // Tracks the artifact ID currently being fetched to prevent concurrent
  // opens of the same artifact (the auto-open effect can fire repeatedly
  // during streaming as canvas state changes trigger re-renders).
  const openingRef = useRef<string | null>(null)
  const artifactChatIdRef = useRef<string | null>(null)

  const isWorkspaceOpen = !!(artifact || isLoading || pendingWorkspace)

  const clearWorkspaceState = useCallback(() => {
    setArtifact(null)
    setPendingWorkspaceState(null)
    setCompileProgressState(null)
    artifactChatIdRef.current = null
  }, [])

  /** Apply an API response state and sync the rotated guest token if changed. */
  const applyState = useCallback(
    (state: CanvasArtifactState) => {
      setArtifact(state)
      setArtifactId(state.artifactId)
      artifactChatIdRef.current = state.chatId

      if (pendingWorkspace?.artifactId === state.artifactId) {
        setPendingWorkspaceState(null)
      }

      if (
        state.guestCanvasToken &&
        state.guestCanvasToken !== guestTokenRef.current
      ) {
        guestTokenRef.current = state.guestCanvasToken
        setGuestCanvasToken(state.guestCanvasToken)
      }
    },
    [pendingWorkspace?.artifactId]
  )

  // ── Core actions ─────────────────────────────────────────────────

  const openCanvasArtifact = useCallback(
    async (id: string, guestToken?: string | null, chatId?: string | null) => {
      if (!id) return // Guard against empty artifactId (e.g. from failed creates)
      if (openingRef.current === id) return // Already fetching this artifact

      openingRef.current = id
      clearWorkspaceState()
      setArtifactId(id)
      setIsLoading(true)

      try {
        const effectiveGuestToken = guestToken ?? guestTokenRef.current
        if (guestToken !== undefined) {
          guestTokenRef.current = guestToken
          setGuestCanvasToken(guestToken)
        }

        const url = buildUrl(id, '', effectiveGuestToken, chatId)
        const res = await fetch(url)
        if (!res.ok) {
          console.error('Failed to load canvas artifact:', res.status)
          setArtifact(null)
          return
        }
        const state: CanvasArtifactState = await res.json()
        applyState(state)
      } catch (err) {
        console.error('Error loading canvas artifact:', err)
        setArtifact(null)
      } finally {
        if (openingRef.current === id) {
          openingRef.current = null
          setIsLoading(false)
        }
      }
    },
    [applyState, clearWorkspaceState]
  )

  const focusCanvasArtifact = useCallback(
    (id: string, chatId?: string | null) => {
      if (!id) return // Guard against empty artifactId

      if (artifact && artifact.artifactId === id) {
        // Already loaded, no-op
        return
      }
      // Already fetching this artifact — don't re-trigger
      if (openingRef.current === id) return

      // Not loaded yet, fall through to full open
      openCanvasArtifact(id, undefined, chatId)
    },
    [artifact, openCanvasArtifact]
  )

  const closeWorkspace = useCallback(() => {
    openingRef.current = null
    artifactChatIdRef.current = null
    setArtifact(null)
    setArtifactId(null)
    setIsLoading(false)
    setPendingWorkspaceState(null)
    setCompileProgressState(null)
  }, [])

  const requestCanvasAiUpdate = useCallback((context: string) => {
    window.dispatchEvent(
      new CustomEvent('canvas-ai-update-requested', {
        detail: { context }
      })
    )
  }, [])

  const setPendingWorkspace = useCallback(
    (workspace: PendingCanvasWorkspace | null) => {
      if (
        workspace?.artifactId &&
        workspace.artifactId !== artifactId &&
        pendingWorkspace?.artifactId !== workspace.artifactId
      ) {
        setArtifact(null)
        setCompileProgressState(null)
      }

      setPendingWorkspaceState(workspace)
      if (workspace?.artifactId) {
        setArtifactId(workspace.artifactId)
      }
    },
    [artifactId, pendingWorkspace?.artifactId]
  )

  const clearPendingWorkspace = useCallback(() => {
    setPendingWorkspaceState(null)
  }, [])

  const setCompileProgress = useCallback(
    (progress: CanvasCompileProgressPayload | null) => {
      setCompileProgressState(progress)

      if (progress?.artifactId) {
        setArtifactId(progress.artifactId)
      }
    },
    []
  )

  const clearCompileProgress = useCallback(() => {
    setCompileProgressState(null)
  }, [])

  const reloadArtifact = useCallback(async () => {
    if (!artifactId) return

    setIsLoading(true)
    try {
      const url = buildUrl(
        artifactId,
        '',
        guestTokenRef.current,
        artifactChatIdRef.current
      )
      const res = await fetch(url)
      if (!res.ok) {
        console.error('Failed to reload canvas artifact:', res.status)
        return
      }
      const state: CanvasArtifactState = await res.json()
      applyState(state)
    } catch (err) {
      console.error('Error reloading canvas artifact:', err)
    } finally {
      setIsLoading(false)
    }
  }, [artifactId, applyState])

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
      if (guestTokenRef.current) {
        body.guestCanvasToken = guestTokenRef.current
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
      applyState(state)
      return state
    },
    [artifactId, applyState]
  )

  const saveVersion =
    useCallback(async (): Promise<CanvasArtifactState | null> => {
      if (!artifactId) return null

      const url = buildUrl(artifactId, '/versions', null)
      const body: Record<string, unknown> = {}
      if (guestTokenRef.current) {
        body.guestCanvasToken = guestTokenRef.current
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
      applyState(state)
      return state
    }, [artifactId, applyState])

  const restoreVersion = useCallback(
    async (versionId: string): Promise<CanvasArtifactState | null> => {
      if (!artifactId || !artifact) return null

      const url = buildUrl(artifactId, '/restore', null)
      const body: Record<string, unknown> = {
        versionId,
        baseRevision: artifact.draftRevision
      }
      if (guestTokenRef.current) {
        body.guestCanvasToken = guestTokenRef.current
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
      applyState(state)
      return state
    },
    [artifactId, artifact, applyState]
  )

  const viewFullscreen = useCallback(() => {
    if (!artifactId) return
    const url = buildUrl(artifactId, '/view', guestTokenRef.current)
    window.open(url, '_blank')
  }, [artifactId])

  const exportHtml = useCallback(async () => {
    if (!artifactId) return

    const url = buildUrl(artifactId, '/export', guestTokenRef.current)

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
  }, [artifactId])

  // ── Render ───────────────────────────────────────────────────────

  const value = useMemo<CanvasContextValue>(
    () => ({
      artifactId,
      artifact,
      isLoading,
      isWorkspaceOpen,
      guestCanvasToken,
      pendingWorkspace,
      compileProgress,
      openCanvasArtifact,
      focusCanvasArtifact,
      closeWorkspace,
      requestCanvasAiUpdate,
      reloadArtifact,
      setGuestCanvasToken,
      setPendingWorkspace,
      clearPendingWorkspace,
      setCompileProgress,
      clearCompileProgress,
      setArtifact,
      updateDraft,
      saveVersion,
      restoreVersion,
      exportHtml,
      viewFullscreen
    }),
    [
      artifactId,
      artifact,
      isLoading,
      isWorkspaceOpen,
      guestCanvasToken,
      pendingWorkspace,
      compileProgress,
      openCanvasArtifact,
      focusCanvasArtifact,
      closeWorkspace,
      requestCanvasAiUpdate,
      reloadArtifact,
      setGuestCanvasToken,
      setPendingWorkspace,
      clearPendingWorkspace,
      setCompileProgress,
      clearCompileProgress,
      setArtifact,
      updateDraft,
      saveVersion,
      restoreVersion,
      exportHtml,
      viewFullscreen
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
