import React from 'react'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────

let mockParams: { id?: string } = {}
vi.mock('next/navigation', () => ({
  useParams: () => mockParams
}))

// Track CanvasProvider mount lifecycle to assert remounts on key change.
const canvasMounts: string[] = []
vi.mock('./canvas-context', () => ({
  CanvasProvider: ({ children }: { children: React.ReactNode }) => {
    const id = React.useId()
    React.useEffect(() => {
      canvasMounts.push(`mount:${id}`)
      return () => {
        canvasMounts.push(`unmount:${id}`)
      }
    }, [id])
    return <>{children}</>
  }
}))

vi.mock('@/components/activity/activity-context', () => ({
  ActivityProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )
}))

vi.mock('./chat-canvas-shell', () => ({
  ChatCanvasShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shell">{children}</div>
  )
}))

import { CanvasRoot } from './canvas-root'

// ── Tests ────────────────────────────────────────────────────────

describe('CanvasRoot', () => {
  beforeEach(() => {
    canvasMounts.length = 0
    mockParams = {}
  })

  it('mounts CanvasProvider once when params.id is stable', () => {
    mockParams = { id: 'chat-a' }

    const { rerender } = render(
      <CanvasRoot>
        <div>Chat</div>
      </CanvasRoot>
    )

    const mountsAfterFirstRender = canvasMounts.filter(e =>
      e.startsWith('mount:')
    ).length

    // Rerender with same params — provider key unchanged, no remount.
    rerender(
      <CanvasRoot>
        <div>Chat</div>
      </CanvasRoot>
    )

    const mountsAfterSecondRender = canvasMounts.filter(e =>
      e.startsWith('mount:')
    ).length

    expect(mountsAfterSecondRender).toBe(mountsAfterFirstRender)
  })

  it('remounts CanvasProvider when params.id changes', () => {
    mockParams = { id: 'chat-a' }

    const { rerender } = render(
      <CanvasRoot>
        <div>Chat</div>
      </CanvasRoot>
    )

    const firstMounts = canvasMounts.filter(e => e.startsWith('mount:'))
    expect(firstMounts).toHaveLength(1)

    // Simulate navigation: params.id changes to a different chat.
    mockParams = { id: 'chat-b' }
    rerender(
      <CanvasRoot>
        <div>Chat</div>
      </CanvasRoot>
    )

    const allMounts = canvasMounts.filter(e => e.startsWith('mount:'))
    const allUnmounts = canvasMounts.filter(e => e.startsWith('unmount:'))

    // Old provider unmounted, new provider mounted — fresh state scope
    // per chat, so state from chat-a cannot leak into chat-b.
    expect(allMounts).toHaveLength(2)
    expect(allUnmounts).toHaveLength(1)
    // The unmount was the first-mounted instance.
    expect(allUnmounts[0]).toBe(firstMounts[0].replace('mount:', 'unmount:'))
  })

  it('treats missing params.id as "new" and remounts when transitioning to a chat id', () => {
    // Home page: no chat id.
    mockParams = {}

    const { rerender } = render(
      <CanvasRoot>
        <div>Chat</div>
      </CanvasRoot>
    )

    expect(canvasMounts.filter(e => e.startsWith('mount:'))).toHaveLength(1)

    // Navigate to a chat — key goes from 'new' to the chat id.
    mockParams = { id: 'chat-x' }
    rerender(
      <CanvasRoot>
        <div>Chat</div>
      </CanvasRoot>
    )

    expect(canvasMounts.filter(e => e.startsWith('mount:'))).toHaveLength(2)
    expect(canvasMounts.filter(e => e.startsWith('unmount:'))).toHaveLength(1)
  })

  it('renders the children subtree', () => {
    mockParams = { id: 'chat-a' }

    render(
      <CanvasRoot>
        <div data-testid="chat-content">Chat</div>
      </CanvasRoot>
    )

    expect(screen.getByTestId('chat-content')).toBeInTheDocument()
    expect(screen.getByTestId('shell')).toBeInTheDocument()
  })
})
