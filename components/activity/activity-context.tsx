'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useReducer
} from 'react'

import type { ToolPart } from '@/lib/types/ai'

import type { SerializableCitation } from '@/components/tool-ui/citation/schema'
import type { SerializableLinkPreview } from '@/components/tool-ui/link-preview/schema'

type ModeIndicatorData = {
  label?: string
}

type ActivityItemData =
  | ToolPart<'search'>
  | ToolPart<'fetch'>
  | SerializableLinkPreview
  | SerializableCitation
  | ModeIndicatorData

export interface ActivityItem {
  id: string
  timestamp: number
  type: 'search' | 'fetch' | 'link-preview' | 'citation' | 'mode-indicator'
  data: ActivityItemData
  state: 'active' | 'complete' | 'error'
}

export interface ActivityState {
  isOpen: boolean
  isResearchMode: boolean
  items: ActivityItem[]
  searchModeLabel: string | null
}

type ActivityAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE' }
  | { type: 'SET_RESEARCH_MODE'; payload: { mode: boolean; label?: string } }
  | { type: 'ADD_ITEM'; payload: Omit<ActivityItem, 'timestamp'> }
  | {
      type: 'UPDATE_ITEM'
      payload: {
        id: string
        updates: Partial<Pick<ActivityItem, 'state' | 'data'>>
      }
    }
  | { type: 'RESET' }

const initialState: ActivityState = {
  isOpen: false,
  isResearchMode: false,
  items: [],
  searchModeLabel: null
}

function activityReducer(
  state: ActivityState,
  action: ActivityAction
): ActivityState {
  switch (action.type) {
    case 'OPEN':
      return { ...state, isOpen: true }
    case 'CLOSE':
      return { ...state, isOpen: false }
    case 'TOGGLE':
      return { ...state, isOpen: !state.isOpen }
    case 'SET_RESEARCH_MODE':
      return {
        ...state,
        isResearchMode: action.payload.mode,
        searchModeLabel: action.payload.label ?? null
      }
    case 'ADD_ITEM':
      return {
        ...state,
        items: [...state.items, { ...action.payload, timestamp: Date.now() }]
      }
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, ...action.payload.updates }
            : item
        )
      }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

interface ActivityContextValue {
  state: ActivityState
  open: () => void
  close: () => void
  toggle: () => void
  setResearchMode: (mode: boolean, label?: string) => void
  addItem: (item: Omit<ActivityItem, 'timestamp'>) => void
  updateItem: (
    id: string,
    updates: Partial<Pick<ActivityItem, 'state' | 'data'>>
  ) => void
  reset: () => void
}

const ActivityContext = createContext<ActivityContextValue | undefined>(
  undefined
)

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(activityReducer, initialState)

  const open = useCallback(() => {
    dispatch({ type: 'OPEN' })
  }, [])

  const close = useCallback(() => {
    dispatch({ type: 'CLOSE' })
  }, [])

  const toggle = useCallback(() => {
    dispatch({ type: 'TOGGLE' })
  }, [])

  const setResearchMode = useCallback((mode: boolean, label?: string) => {
    dispatch({ type: 'SET_RESEARCH_MODE', payload: { mode, label } })
  }, [])

  const addItem = useCallback((item: Omit<ActivityItem, 'timestamp'>) => {
    dispatch({ type: 'ADD_ITEM', payload: item })
  }, [])

  const updateItem = useCallback(
    (id: string, updates: Partial<Pick<ActivityItem, 'state' | 'data'>>) => {
      dispatch({ type: 'UPDATE_ITEM', payload: { id, updates } })
    },
    []
  )

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return (
    <ActivityContext.Provider
      value={{
        state,
        open,
        close,
        toggle,
        setResearchMode,
        addItem,
        updateItem,
        reset
      }}
    >
      {children}
    </ActivityContext.Provider>
  )
}

export function useActivity() {
  const context = useContext(ActivityContext)
  if (context === undefined) {
    throw new Error('useActivity must be used within an ActivityProvider')
  }
  return context
}
