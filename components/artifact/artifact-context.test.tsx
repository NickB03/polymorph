import { ReactNode } from 'react'

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ArtifactProvider, useArtifact } from './artifact-context'

// Mock the sidebar context that ArtifactProvider depends on
vi.mock('../ui/sidebar', () => ({
  useSidebar: () => ({
    setOpen: vi.fn(),
    open: false
  })
}))

function wrapper({ children }: { children: ReactNode }) {
  return <ArtifactProvider>{children}</ArtifactProvider>
}

describe('ArtifactContext', () => {
  describe('initial state', () => {
    it('starts with no inspected part and workspace closed', () => {
      const { result } = renderHook(() => useArtifact(), { wrapper })
      expect(result.current.state.inspectedPart).toBeNull()
      expect(result.current.state.workspace.isOpen).toBe(false)
    })
  })

  describe('open(part)', () => {
    it('opens with a search tool part (backward compat)', () => {
      const { result } = renderHook(() => useArtifact(), { wrapper })

      const searchPart = {
        type: 'tool-search' as const,
        toolCallId: 'tc-1',
        state: 'output-available' as const,
        input: { query: 'test query' },
        output: { results: [] }
      }

      act(() => {
        result.current.open(searchPart)
      })

      expect(result.current.state.inspectedPart).toEqual(searchPart)
      expect(result.current.state.inspectedPart?.type).toBe('tool-search')
    })

    it('opens with a reasoning part (backward compat)', () => {
      const { result } = renderHook(() => useArtifact(), { wrapper })

      const reasoningPart = {
        type: 'reasoning' as const,
        text: 'thinking about the problem...'
      }

      act(() => {
        result.current.open(reasoningPart)
      })

      expect(result.current.state.inspectedPart).toEqual(reasoningPart)
      expect(result.current.state.inspectedPart?.type).toBe('reasoning')
    })

    it('opens with a data-artifact part', () => {
      const { result } = renderHook(() => useArtifact(), { wrapper })

      const artifactDataPart = {
        type: 'data-artifact' as const,
        id: 'part-1',
        data: {
          id: 'artifact-1',
          title: 'My Dashboard',
          status: 'ready' as const,
          previewUrl: 'https://preview.example.com'
        }
      }

      act(() => {
        result.current.open(artifactDataPart)
      })

      expect(result.current.state.inspectedPart).toEqual(artifactDataPart)
    })

    it('replaces current part when opening a new one', () => {
      const { result } = renderHook(() => useArtifact(), { wrapper })

      const firstPart = {
        type: 'tool-search' as const,
        toolCallId: 'tc-1',
        state: 'output-available' as const,
        input: { query: 'first' },
        output: { results: [] }
      }

      const secondPart = {
        type: 'reasoning' as const,
        text: 'second part'
      }

      act(() => {
        result.current.open(firstPart)
      })
      expect(result.current.state.inspectedPart?.type).toBe('tool-search')

      act(() => {
        result.current.open(secondPart)
      })
      expect(result.current.state.inspectedPart?.type).toBe('reasoning')
    })
  })

  describe('close()', () => {
    it('clears inspected part after animation', () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useArtifact(), { wrapper })

      act(() => {
        result.current.open({
          type: 'reasoning' as const,
          text: 'some reasoning'
        })
      })
      expect(result.current.state.inspectedPart).not.toBeNull()

      act(() => {
        result.current.close()
      })

      // After animation duration, content is cleared
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(result.current.state.inspectedPart).toBeNull()

      vi.useRealTimers()
    })
  })

  describe('workspace actions', () => {
    it('openWorkspace sets workspace.isOpen to true', () => {
      const { result } = renderHook(() => useArtifact(), { wrapper })

      act(() => {
        result.current.openWorkspace({
          artifactId: 'a-1',
          title: 'My App',
          status: 'ready'
        })
      })

      expect(result.current.state.workspace.isOpen).toBe(true)
      expect(result.current.state.workspace.artifactId).toBe('a-1')
      expect(result.current.state.workspace.title).toBe('My App')
    })

    it('updateWorkspace merges partial state', () => {
      const { result } = renderHook(() => useArtifact(), { wrapper })

      act(() => {
        result.current.openWorkspace({
          artifactId: 'a-1',
          title: 'My App',
          status: 'building'
        })
      })

      act(() => {
        result.current.updateWorkspace({
          status: 'ready',
          previewUrl: 'https://preview.test'
        })
      })

      expect(result.current.state.workspace.status).toBe('ready')
      expect(result.current.state.workspace.previewUrl).toBe(
        'https://preview.test'
      )
      expect(result.current.state.workspace.artifactId).toBe('a-1')
    })

    it('closeWorkspace resets workspace state', () => {
      const { result } = renderHook(() => useArtifact(), { wrapper })

      act(() => {
        result.current.openWorkspace({
          artifactId: 'a-1',
          title: 'My App',
          status: 'ready'
        })
      })
      expect(result.current.state.workspace.isOpen).toBe(true)

      act(() => {
        result.current.closeWorkspace()
      })
      expect(result.current.state.workspace.isOpen).toBe(false)
      expect(result.current.state.workspace.artifactId).toBeNull()
    })
  })

  describe('coexistence: inspector and workspace are independent', () => {
    it('can open different part types sequentially without state corruption', () => {
      const { result } = renderHook(() => useArtifact(), { wrapper })

      // Open search (inspector)
      act(() => {
        result.current.open({
          type: 'tool-search' as const,
          toolCallId: 'tc-1',
          state: 'output-available' as const,
          input: { query: 'search' },
          output: { results: [] }
        })
      })
      expect(result.current.state.inspectedPart?.type).toBe('tool-search')

      // Open workspace (independent of inspector)
      act(() => {
        result.current.openWorkspace({
          artifactId: 'a-1',
          title: 'App',
          status: 'ready'
        })
      })
      expect(result.current.state.workspace.isOpen).toBe(true)
      // Inspector part is still set
      expect(result.current.state.inspectedPart?.type).toBe('tool-search')

      // Switch inspector to reasoning
      act(() => {
        result.current.open({
          type: 'reasoning' as const,
          text: 'thinking...'
        })
      })
      expect(result.current.state.inspectedPart?.type).toBe('reasoning')
      // Workspace still open
      expect(result.current.state.workspace.isOpen).toBe(true)
    })
  })

  describe('error handling', () => {
    it('throws when useArtifact is used outside ArtifactProvider', () => {
      expect(() => {
        renderHook(() => useArtifact())
      }).toThrow('useArtifact must be used within an ArtifactProvider')
    })
  })
})
