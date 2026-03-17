'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState
} from 'react'
import { usePathname } from 'next/navigation'

import type { Part } from '@/lib/types/ai'
import type {
  ArtifactLogData,
  ArtifactSourceFile,
  ArtifactStatus
} from '@/lib/types/artifact'

import { useSidebar } from '../ui/sidebar'

// Animation duration should match CSS transition duration
const ANIMATION_DURATION = 300

export type WorkspaceTab = 'preview' | 'code'

export interface ArtifactWorkspaceState {
  artifactId: string | null
  revisionId: string | null
  title: string | null
  status: ArtifactStatus | null
  previewUrl: string | null
  guestArtifactToken: string | null
  sourceFiles: ArtifactSourceFile[]
  canRebuild: boolean
  isOpen: boolean
}

export interface ArtifactUiState {
  inspectedPart: Part | null
  workspace: ArtifactWorkspaceState
}

const initialWorkspace: ArtifactWorkspaceState = {
  artifactId: null,
  revisionId: null,
  title: null,
  status: null,
  previewUrl: null,
  guestArtifactToken: null,
  sourceFiles: [],
  canRebuild: false,
  isOpen: false
}

const initialState: ArtifactUiState = {
  inspectedPart: null,
  workspace: initialWorkspace
}

type ArtifactAction =
  | { type: 'OPEN_INSPECTOR'; payload: Part }
  | { type: 'CLOSE_INSPECTOR' }
  | { type: 'CLEAR_INSPECTOR' }
  | { type: 'OPEN_WORKSPACE'; payload: Partial<ArtifactWorkspaceState> }
  | { type: 'UPDATE_WORKSPACE'; payload: Partial<ArtifactWorkspaceState> }
  | { type: 'CLOSE_WORKSPACE' }

function artifactReducer(
  state: ArtifactUiState,
  action: ArtifactAction
): ArtifactUiState {
  switch (action.type) {
    case 'OPEN_INSPECTOR':
      return { ...state, inspectedPart: action.payload }
    case 'CLOSE_INSPECTOR':
      return { ...state, inspectedPart: null }
    case 'CLEAR_INSPECTOR':
      return { ...state, inspectedPart: null }
    case 'OPEN_WORKSPACE':
      return {
        ...state,
        workspace: {
          ...state.workspace,
          ...action.payload,
          isOpen: true
        }
      }
    case 'UPDATE_WORKSPACE':
      return {
        ...state,
        workspace: {
          ...state.workspace,
          ...action.payload
        }
      }
    case 'CLOSE_WORKSPACE':
      return {
        ...state,
        workspace: initialWorkspace
      }
    default:
      return state
  }
}

interface ArtifactContextValue {
  state: ArtifactUiState
  open: (part: Part) => void
  close: () => void
  openWorkspace: (ws: Partial<ArtifactWorkspaceState>) => void
  updateWorkspace: (ws: Partial<ArtifactWorkspaceState>) => void
  closeWorkspace: () => void
  appendWorkspaceLog: (log: ArtifactLogData) => void
  workspaceLogs: ArtifactLogData[]
  requestAiFix: ((errorContext: string) => void) | null
  setRequestAiFix: (cb: ((errorContext: string) => void) | null) => void
}

const ArtifactContext = createContext<ArtifactContextValue | undefined>(
  undefined
)

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(artifactReducer, initialState)
  const { setOpen, open: sidebarOpen } = useSidebar()
  const [workspaceLogs, setWorkspaceLogs] = useState<ArtifactLogData[]>([])
  const [requestAiFix, setRequestAiFix] = useState<
    ((errorContext: string) => void) | null
  >(null)
  const isInspectorOpen =
    state.inspectedPart !== null && !state.workspace.isOpen

  // Auto-close workspace and inspector when the user navigates away.
  // ArtifactProvider lives in the root layout so its state survives
  // route transitions — this effect ensures stale panels don't linger.
  const pathname = usePathname()
  const prevPathRef = useRef(pathname)
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname
      dispatch({ type: 'CLOSE_WORKSPACE' })
      dispatch({ type: 'CLEAR_INSPECTOR' })
      setWorkspaceLogs([])
    }
  }, [pathname])

  const close = useCallback(() => {
    dispatch({ type: 'CLOSE_INSPECTOR' })
    // Keep content for animation purposes, clear after transition
    setTimeout(() => {
      dispatch({ type: 'CLEAR_INSPECTOR' })
    }, ANIMATION_DURATION)
  }, [])

  // Close inspector when sidebar opens
  useEffect(() => {
    if (sidebarOpen && isInspectorOpen) {
      close()
    }
  }, [sidebarOpen, isInspectorOpen, close])

  const open = useCallback(
    (part: Part) => {
      dispatch({ type: 'OPEN_INSPECTOR', payload: part })
      setOpen(false)
    },
    [setOpen]
  )

  const openWorkspace = useCallback(
    (ws: Partial<ArtifactWorkspaceState>) => {
      setWorkspaceLogs([])
      dispatch({ type: 'OPEN_WORKSPACE', payload: ws })
      setOpen(false)
    },
    [setOpen]
  )

  const updateWorkspace = useCallback((ws: Partial<ArtifactWorkspaceState>) => {
    dispatch({ type: 'UPDATE_WORKSPACE', payload: ws })
  }, [])

  const closeWorkspace = useCallback(() => {
    dispatch({ type: 'CLOSE_WORKSPACE' })
    setWorkspaceLogs([])
  }, [])

  const appendWorkspaceLog = useCallback((log: ArtifactLogData) => {
    setWorkspaceLogs(prev => [...prev, log].slice(-200))
  }, [])

  return (
    <ArtifactContext.Provider
      value={{
        state,
        open,
        close,
        openWorkspace,
        updateWorkspace,
        closeWorkspace,
        appendWorkspaceLog,
        workspaceLogs,
        requestAiFix,
        setRequestAiFix
      }}
    >
      {children}
    </ArtifactContext.Provider>
  )
}

export function useArtifact() {
  const context = useContext(ArtifactContext)
  if (context === undefined) {
    throw new Error('useArtifact must be used within an ArtifactProvider')
  }
  return context
}

/**
 * Shared hook for calling artifact action endpoints (refresh, retry).
 * Eliminates duplicated fetch + updateWorkspace logic across components.
 */
export function useArtifactAction(action: 'refresh' | 'retry' | 'rebuild') {
  const { state, updateWorkspace } = useArtifact()
  const { workspace } = state
  const [isPending, setIsPending] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Use refs for values read inside the callback so they don't
  // destabilize the callback identity. Without this, `workspace`
  // (a new object on every dispatch) causes `execute` to regenerate,
  // which triggers a probe-refresh loop in ArtifactPreviewFrame.
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace
  const isPendingRef = useRef(isPending)
  isPendingRef.current = isPending

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const execute = useCallback(async () => {
    const ws = workspaceRef.current
    if (!ws.artifactId || isPendingRef.current) return

    // Cancel any previous in-flight request to prevent stale responses
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsPending(true)
    try {
      const res = await fetch(`/api/artifacts/${ws.artifactId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          guestArtifactToken: ws.guestArtifactToken ?? undefined
        }),
        signal: controller.signal
      })
      if (controller.signal.aborted) return
      if (res.ok) {
        const data = await res.json()
        if (controller.signal.aborted) return
        updateWorkspace({
          status: data.status ?? ws.status,
          // Use explicit undefined check: the API returns `null` to clear
          // the preview URL on expiry. `null ?? ws.previewUrl` would
          // incorrectly preserve the stale URL.
          previewUrl:
            data.previewUrl !== undefined ? data.previewUrl : ws.previewUrl,
          revisionId: data.revisionId ?? ws.revisionId,
          title: data.title ?? ws.title,
          guestArtifactToken: data.guestArtifactToken ?? ws.guestArtifactToken,
          ...(data.canRebuild !== undefined
            ? { canRebuild: data.canRebuild }
            : {})
        })
      } else {
        try {
          const err = await res.json()
          if (controller.signal.aborted) return
          if (err.code === 'TOKEN_EXPIRED' || err.code === 'SANDBOX_EXPIRED') {
            updateWorkspace({
              status: 'expired',
              previewUrl: null,
              canRebuild: true
            })
          }
        } catch {
          // Response wasn't JSON — ignore
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      throw e
    } finally {
      if (!controller.signal.aborted) {
        setIsPending(false)
      }
    }
  }, [updateWorkspace, action])

  return { execute, isPending }
}

/** Format workspace logs into an "Ask AI to fix" prompt. */
export function formatArtifactFixPrompt(
  logs: { message: string; level?: string }[]
): string {
  const context = logs
    .slice(-20)
    .map(l => l.message)
    .join('\n')
  return `The artifact build failed with the following error. Please diagnose and fix the source code:\n\n\`\`\`\n${context}\n\`\`\``
}
