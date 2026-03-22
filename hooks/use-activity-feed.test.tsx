import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

const mockCanvas = {
  isWorkspaceOpen: false
}

const mockActivityState = {
  isOpen: false,
  isResearchMode: false,
  items: [],
  searchModeLabel: null as string | null
}

const mockActivity = {
  state: mockActivityState,
  open: vi.fn(() => {
    mockActivityState.isOpen = true
  }),
  close: vi.fn(() => {
    mockActivityState.isOpen = false
  }),
  toggle: vi.fn(),
  setResearchMode: vi.fn((mode: boolean, label?: string) => {
    mockActivityState.isResearchMode = mode
    mockActivityState.searchModeLabel = label ?? null
  }),
  addItem: vi.fn(),
  updateItem: vi.fn(),
  reset: vi.fn(() => {
    mockActivityState.isOpen = false
    mockActivityState.isResearchMode = false
    mockActivityState.items = []
    mockActivityState.searchModeLabel = null
  })
}

let useActivityFeed: typeof import('./use-activity-feed').useActivityFeed

vi.mock('@/components/activity/activity-context', () => ({
  useActivity: () => mockActivity
}))

vi.mock('@/components/canvas/canvas-context', () => ({
  useCanvas: () => mockCanvas
}))

vi.mock('@/components/tool-ui/citation/schema', () => ({
  safeParseSerializableCitation: () => null
}))

vi.mock('@/components/tool-ui/link-preview/schema', () => ({
  safeParseSerializableLinkPreview: () => null
}))

function makeAssistantMessage({
  chatId = 'chat-1',
  toolCallId = 'search-1'
}: {
  chatId?: string
  toolCallId?: string
} = {}): UIMessage {
  return {
    id: `${chatId}-assistant`,
    role: 'assistant',
    metadata: {
      searchMode: 'research'
    },
    parts: [
      {
        type: 'tool-search',
        toolCallId,
        input: { query: 'climate data' },
        state: 'output-available',
        output: {
          state: 'complete',
          results: []
        }
      }
    ]
  } as UIMessage
}

describe('useActivityFeed', () => {
  beforeEach(async () => {
    mockCanvas.isWorkspaceOpen = false
    mockActivityState.isOpen = false
    mockActivityState.isResearchMode = false
    mockActivityState.items = []
    mockActivityState.searchModeLabel = null

    vi.clearAllMocks()
    ;({ useActivityFeed } = await import('./use-activity-feed'))
  })

  it('opens activity immediately when the workspace is closed', async () => {
    const messages = [makeAssistantMessage()]

    renderHook(() => useActivityFeed(messages, undefined, 'chat-1'))

    await waitFor(() => {
      expect(mockActivity.addItem).toHaveBeenCalledTimes(1)
      expect(mockActivity.open).toHaveBeenCalledTimes(1)
    })
  })

  it('defers opening until the workspace closes', async () => {
    mockCanvas.isWorkspaceOpen = true
    const messages = [makeAssistantMessage()]

    const { rerender } = renderHook(
      ({ chatId }) => useActivityFeed(messages, undefined, chatId),
      {
        initialProps: { chatId: 'chat-1' }
      }
    )

    await waitFor(() => {
      expect(mockActivity.addItem).toHaveBeenCalledTimes(1)
      expect(mockActivity.open).not.toHaveBeenCalled()
    })

    mockCanvas.isWorkspaceOpen = false
    rerender({ chatId: 'chat-1' })

    await waitFor(() => {
      expect(mockActivity.open).toHaveBeenCalledTimes(1)
    })
  })

  it('resets seen activity when the chat changes', async () => {
    const firstMessages = [makeAssistantMessage({ chatId: 'chat-1' })]
    const secondMessages = [makeAssistantMessage({ chatId: 'chat-2' })]

    const { rerender } = renderHook(
      ({ chatId, messages }) => useActivityFeed(messages, undefined, chatId),
      {
        initialProps: { chatId: 'chat-1', messages: firstMessages }
      }
    )

    await waitFor(() => {
      expect(mockActivity.addItem).toHaveBeenCalledTimes(1)
      expect(mockActivity.open).toHaveBeenCalledTimes(1)
    })

    rerender({ chatId: 'chat-1', messages: firstMessages })
    await waitFor(() => {
      expect(mockActivity.addItem).toHaveBeenCalledTimes(1)
    })

    rerender({ chatId: 'chat-2', messages: secondMessages })

    await waitFor(() => {
      expect(mockActivity.reset).toHaveBeenCalledTimes(1)
      expect(mockActivity.addItem).toHaveBeenCalledTimes(2)
      expect(mockActivity.open).toHaveBeenCalledTimes(2)
    })
  })

  it('does not reopen deferred activity from a previous chat', async () => {
    mockCanvas.isWorkspaceOpen = true
    const firstMessages = [makeAssistantMessage({ chatId: 'chat-1' })]
    const secondMessages = [makeAssistantMessage({ chatId: 'chat-2' })]

    const { rerender } = renderHook(
      ({ chatId, messages }) => useActivityFeed(messages, undefined, chatId),
      {
        initialProps: { chatId: 'chat-1', messages: firstMessages }
      }
    )

    await waitFor(() => {
      expect(mockActivity.addItem).toHaveBeenCalledTimes(1)
      expect(mockActivity.open).not.toHaveBeenCalled()
    })

    rerender({ chatId: 'chat-2', messages: secondMessages })

    await waitFor(() => {
      expect(mockActivity.reset).toHaveBeenCalledTimes(1)
      expect(mockActivity.addItem).toHaveBeenCalledTimes(2)
      expect(mockActivity.open).not.toHaveBeenCalled()
    })

    mockCanvas.isWorkspaceOpen = false
    rerender({ chatId: 'chat-2', messages: secondMessages })

    await waitFor(() => {
      expect(mockActivity.open).toHaveBeenCalledTimes(1)
    })
  })
})
