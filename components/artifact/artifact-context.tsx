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
import type { ArtifactLogData, ArtifactStatus } from '@/lib/types/artifact'

import { useSidebar } from '../ui/sidebar'

// Animation duration should match CSS transition duration
const ANIMATION_DURATION = 300

export interface ArtifactWorkspaceState {
  artifactId: string | null
  revisionId: string | null
  title: string | null
  status: ArtifactStatus | null
  previewUrl: string | null
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
}

const ArtifactContext = createContext<ArtifactContextValue | undefined>(
  undefined
)

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(artifactReducer, initialState)
  const { setOpen, open: sidebarOpen } = useSidebar()
  const [workspaceLogs, setWorkspaceLogs] = useState<ArtifactLogData[]>([])
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
    setWorkspaceLogs(prev => [...prev, log])
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
        workspaceLogs
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
