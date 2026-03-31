import React from 'react'

import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stub ResizeObserver which is not available in jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// ── Mocks ────────────────────────────────────────────────────────

let mockIsMobile = false
vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({
    open: false,
    setOpen: vi.fn(),
    isMobile: mockIsMobile
  })
}))

const mockCanvasContext = {
  isWorkspaceOpen: false,
  artifact: null,
  isLoading: false,
  legacyNotice: null,
  pendingWorkspace: null,
  compileProgress: null,
  closeWorkspace: vi.fn()
}
vi.mock('./canvas-context', () => ({
  useCanvas: () => mockCanvasContext
}))

vi.mock('@/components/activity/activity-context', () => ({
  useActivity: () => ({
    state: {
      isOpen: false,
      isResearchMode: false,
      items: [],
      searchModeLabel: null
    },
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
    setResearchMode: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    reset: vi.fn()
  })
}))

vi.mock('./canvas-workspace', () => ({
  CanvasWorkspace: () => <div data-testid="canvas-workspace">workspace</div>
}))

vi.mock('@/components/inspector/inspector-drawer', () => ({
  InspectorDrawer: () => <div data-testid="inspector-drawer" />
}))

vi.mock('@/components/activity/activity-drawer', () => ({
  ActivityDrawer: () => <div data-testid="activity-drawer" />
}))

vi.mock('@/components/inspector/inspector-panel', () => ({
  InspectorPanel: () => <div data-testid="inspector-panel" />
}))

vi.mock('@/components/activity/activity-panel', () => ({
  ActivityPanel: () => <div data-testid="activity-panel" />
}))

import { ChatCanvasShell } from './chat-canvas-shell'

// ── Tests ────────────────────────────────────────────────────────

describe('ChatCanvasShell', () => {
  beforeEach(() => {
    mockIsMobile = false
    mockCanvasContext.isWorkspaceOpen = false
    mockCanvasContext.artifact = null
    mockCanvasContext.isLoading = false
    mockCanvasContext.legacyNotice = null
    mockCanvasContext.pendingWorkspace = null
  })

  describe('mobile layout', () => {
    beforeEach(() => {
      mockIsMobile = true
    })

    it('shows chat content when workspace is closed', () => {
      render(
        <ChatCanvasShell>
          <div data-testid="chat-content">Chat</div>
        </ChatCanvasShell>
      )

      const mobile = within(screen.getByTestId('mobile-shell'))
      expect(mobile.getByTestId('chat-content')).toBeInTheDocument()
      expect(mobile.queryByTestId('canvas-workspace')).not.toBeInTheDocument()
    })

    it('shows workspace and hides chat when workspace is open', () => {
      mockCanvasContext.isWorkspaceOpen = true
      mockCanvasContext.artifact = { artifactId: '1' } as never

      render(
        <ChatCanvasShell>
          <div data-testid="chat-content">Chat</div>
        </ChatCanvasShell>
      )

      const mobile = within(screen.getByTestId('mobile-shell'))
      expect(mobile.getByTestId('canvas-workspace')).toBeInTheDocument()
      expect(mobile.queryByTestId('chat-content')).not.toBeInTheDocument()
    })

    it('shows drawers when workspace is closed', () => {
      render(
        <ChatCanvasShell>
          <div>Chat</div>
        </ChatCanvasShell>
      )

      const mobile = within(screen.getByTestId('mobile-shell'))
      expect(mobile.getByTestId('inspector-drawer')).toBeInTheDocument()
      expect(mobile.getByTestId('activity-drawer')).toBeInTheDocument()
    })

    it('hides drawers when workspace is open', () => {
      mockCanvasContext.isWorkspaceOpen = true
      mockCanvasContext.artifact = { artifactId: '1' } as never

      render(
        <ChatCanvasShell>
          <div>Chat</div>
        </ChatCanvasShell>
      )

      const mobile = within(screen.getByTestId('mobile-shell'))
      expect(mobile.queryByTestId('inspector-drawer')).not.toBeInTheDocument()
      expect(mobile.queryByTestId('activity-drawer')).not.toBeInTheDocument()
    })
  })
})
