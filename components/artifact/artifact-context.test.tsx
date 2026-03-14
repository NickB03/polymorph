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
    it('starts with no part and closed', () => {
      const { result } = renderHook(() => useArtifact(), { wrapper })
      expect(result.current.state.part).toBeNull()
      expect(result.current.state.isOpen).toBe(false)
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

      expect(result.current.state.isOpen).toBe(true)
      expect(result.current.state.part).toEqual(searchPart)
      expect(result.current.state.part?.type).toBe('tool-search')
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

      expect(result.current.state.isOpen).toBe(true)
      expect(result.current.state.part).toEqual(reasoningPart)
      expect(result.current.state.part?.type).toBe('reasoning')
    })

    it('opens with a data-artifact part (workspace auto-open)', () => {
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

      expect(result.current.state.isOpen).toBe(true)
      expect(result.current.state.part).toEqual(artifactDataPart)
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
      expect(result.current.state.part?.type).toBe('tool-search')

      act(() => {
        result.current.open(secondPart)
      })
      expect(result.current.state.part?.type).toBe('reasoning')
      expect(result.current.state.isOpen).toBe(true)
    })
  })

  describe('close()', () => {
    it('sets isOpen to false immediately', () => {
      const { result } = renderHook(() => useArtifact(), { wrapper })

      act(() => {
        result.current.open({
          type: 'reasoning' as const,
          text: 'some reasoning'
        })
      })
      expect(result.current.state.isOpen).toBe(true)

      act(() => {
        result.current.close()
      })
      expect(result.current.state.isOpen).toBe(false)
    })

    it('keeps part content briefly for animation, then clears', () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useArtifact(), { wrapper })

      act(() => {
        result.current.open({
          type: 'reasoning' as const,
          text: 'some reasoning'
        })
      })

      act(() => {
        result.current.close()
      })

      // Part is still present right after close for animation
      expect(result.current.state.isOpen).toBe(false)
      expect(result.current.state.part).not.toBeNull()

      // After animation duration, content is cleared
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(result.current.state.part).toBeNull()

      vi.useRealTimers()
    })
  })

  describe('coexistence: inspector open does not interfere with workspace', () => {
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
      expect(result.current.state.isOpen).toBe(true)
      expect(result.current.state.part?.type).toBe('tool-search')

      // Switch to artifact data (workspace)
      act(() => {
        result.current.open({
          type: 'data-artifact' as const,
          id: 'p-1',
          data: {
            id: 'a-1',
            title: 'App',
            status: 'ready' as const
          }
        })
      })
      expect(result.current.state.isOpen).toBe(true)
      expect(result.current.state.part?.type).toBe('data-artifact')

      // Switch back to reasoning (inspector)
      act(() => {
        result.current.open({
          type: 'reasoning' as const,
          text: 'thinking...'
        })
      })
      expect(result.current.state.isOpen).toBe(true)
      expect(result.current.state.part?.type).toBe('reasoning')
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
