'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState
} from 'react'

import type { Part } from '@/lib/types/ai'
import type {
  ArtifactLogData,
  ArtifactSourceFile,
  ArtifactStatus
} from '@/lib/types/artifact'

import { useSidebar } from '../ui/sidebar'

// Animation duration should match CSS transition duration
const ANIMATION_DURATION = 300

export type WorkspaceTab = 'preview' | 'code' | 'logs'

export interface ArtifactWorkspaceState {
  artifactId: string | null
  revisionId: string | null
  title: string | null
  status: ArtifactStatus | null
  previewUrl: string | null
  guestArtifactToken: string | null
  sourceFiles: ArtifactSourceFile[]
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
export function useArtifactAction(action: 'refresh' | 'retry') {
  const { state, updateWorkspace } = useArtifact()
  const { workspace } = state
  const [isPending, setIsPending] = useState(false)

  const execute = useCallback(async () => {
    if (!workspace.artifactId || isPending) return
    setIsPending(true)
    try {
      const res = await fetch(
        `/api/artifacts/${workspace.artifactId}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            guestArtifactToken: workspace.guestArtifactToken ?? undefined
          })
        }
      )
      if (res.ok) {
        const data = await res.json()
        updateWorkspace({
          status: data.status ?? workspace.status,
          previewUrl: data.previewUrl ?? workspace.previewUrl,
          revisionId: data.revisionId ?? workspace.revisionId,
          title: data.title ?? workspace.title,
          guestArtifactToken:
            data.guestArtifactToken ?? workspace.guestArtifactToken
        })
      }
    } finally {
      setIsPending(false)
    }
  }, [workspace, isPending, updateWorkspace, action])

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
