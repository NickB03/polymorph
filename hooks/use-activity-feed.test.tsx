import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import type { ActivityItem } from '@/components/activity/activity-context'
import type { SerializableLinkPreview } from '@/components/tool-ui/link-preview/schema'

const mockCanvas = {
  isWorkspaceOpen: false
}

let mockLinkPreviewResult: SerializableLinkPreview | null = null

const mockActivityState: {
  isOpen: boolean
  isResearchMode: boolean
  items: ActivityItem[]
  searchModeLabel: string | null
} = {
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
  addItem: vi.fn(item => {
    mockActivityState.items = [
      ...mockActivityState.items,
      { ...item, timestamp: Date.now() }
    ]
  }),
  updateItem: vi.fn((id: string, updates: Record<string, unknown>) => {
    mockActivityState.items = mockActivityState.items.map(item =>
      item.id === id ? { ...item, ...updates } : item
    )
  }),
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
  safeParseSerializableLinkPreview: () => mockLinkPreviewResult
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
    mockLinkPreviewResult = null

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

  it('does not append duplicate activity when the hook remounts for the same chat', async () => {
    const messages = [makeAssistantMessage()]

    const firstRender = renderHook(() =>
      useActivityFeed(messages, undefined, 'chat-1')
    )

    await waitFor(() => {
      expect(mockActivity.addItem).toHaveBeenCalledTimes(1)
      expect(mockActivityState.items).toHaveLength(1)
    })

    firstRender.unmount()

    renderHook(() => useActivityFeed(messages, undefined, 'chat-1'))

    await waitFor(() => {
      expect(mockActivityState.items).toHaveLength(1)
    })
  })

  it('does not update unchanged activity items on rerender', async () => {
    const messages = [makeAssistantMessage()]

    const { rerender } = renderHook(
      ({ nextMessages }) => useActivityFeed(nextMessages, undefined, 'chat-1'),
      {
        initialProps: { nextMessages: messages }
      }
    )

    await waitFor(() => {
      expect(mockActivity.addItem).toHaveBeenCalledTimes(1)
      expect(mockActivityState.items).toHaveLength(1)
    })

    rerender({ nextMessages: messages })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(mockActivity.updateItem).not.toHaveBeenCalled()
  })

  it('updates an activity item when its state changes', async () => {
    const activeMessage = [
      {
        id: 'chat-1-assistant',
        role: 'assistant',
        metadata: { searchMode: 'research' },
        parts: [
          {
            type: 'tool-search',
            toolCallId: 'search-1',
            input: { query: 'test' },
            state: 'input-available',
            output: undefined
          }
        ]
      } as UIMessage
    ]

    const { rerender } = renderHook(
      ({ msgs }) => useActivityFeed(msgs, undefined, 'chat-1'),
      { initialProps: { msgs: activeMessage } }
    )

    await waitFor(() => {
      expect(mockActivity.addItem).toHaveBeenCalledTimes(1)
      expect(mockActivityState.items[0].state).toBe('active')
    })

    const completedMessage = [
      {
        id: 'chat-1-assistant',
        role: 'assistant',
        metadata: { searchMode: 'research' },
        parts: [
          {
            type: 'tool-search',
            toolCallId: 'search-1',
            input: { query: 'test' },
            state: 'output-available',
            output: { state: 'complete', results: [] }
          }
        ]
      } as UIMessage
    ]

    rerender({ msgs: completedMessage })

    await waitFor(() => {
      expect(mockActivity.updateItem).toHaveBeenCalledWith('search:search-1', {
        state: 'complete',
        data: expect.objectContaining({ state: 'output-available' })
      })
    })
  })

  it('keeps different activity item types distinct when they share the same raw id', async () => {
    mockLinkPreviewResult = {
      id: 'call_shared',
      href: 'https://example.com/article',
      title: 'Example article'
    }

    const messages = [
      {
        id: 'chat-1-assistant',
        role: 'assistant',
        metadata: {
          searchMode: 'research'
        },
        parts: [
          {
            type: 'tool-search',
            toolCallId: 'call_shared',
            input: { query: 'shared id search' },
            state: 'output-available',
            output: {
              state: 'complete',
              results: []
            }
          },
          {
            type: 'tool-displayLinkPreview',
            toolCallId: 'display-call-1',
            state: 'output-available',
            output: {
              id: 'call_shared'
            }
          }
        ]
      } as UIMessage
    ]

    renderHook(() => useActivityFeed(messages, undefined, 'chat-1'))

    await waitFor(() => {
      expect(mockActivityState.items).toHaveLength(2)
      expect(mockActivityState.items.map(item => item.id)).toEqual([
        'search:call_shared',
        'link-preview:call_shared'
      ])
    })
  })
})
