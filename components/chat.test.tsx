import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildLegacyCanvasNotice } from '@/lib/canvas/legacy'
import type { UIMessage } from '@/lib/types/ai'

import type { CanvasContextValue } from './canvas/canvas-context'
import { CanvasRoot } from './canvas/canvas-root'
import { buildChatRequestBody, getLatestGuestCanvasToken } from './chat-request'

const mockUseChat = vi.fn()
const mockUseVoiceConversation = vi.fn()
const mockChatMessages = vi.fn((_props?: unknown) => null)
const mockToast = vi.fn()
const mockToastError = vi.fn()
const mockSidebar = {
  setOpen: vi.fn(),
  setOpenMobile: vi.fn(),
  open: false,
  isMobile: false
}
const mockCanvasContext: CanvasContextValue = {
  artifactId: null,
  artifact: null,
  isLoading: false,
  isWorkspaceOpen: false,
  legacyNotice: null,
  guestCanvasToken: null,
  pendingWorkspace: null,
  compileProgress: null,
  openCanvasArtifact: vi.fn(),
  focusCanvasArtifact: vi.fn(),
  openLegacyCanvasNotice: vi.fn(),
  closeWorkspace: vi.fn(),
  requestCanvasAiUpdate: vi.fn(),
  reloadArtifact: vi.fn(),
  setGuestCanvasToken: vi.fn(),
  setPendingWorkspace: vi.fn(),
  clearPendingWorkspace: vi.fn(),
  setCompileProgress: vi.fn(),
  clearCompileProgress: vi.fn(),
  setArtifact: vi.fn(),
  updateDraft: vi.fn(),
  saveVersion: vi.fn(),
  restoreVersion: vi.fn(),
  exportHtml: vi.fn(),
  viewFullscreen: vi.fn()
}

function resetCanvasContext() {
  mockCanvasContext.artifactId = null
  mockCanvasContext.artifact = null
  mockCanvasContext.isLoading = false
  mockCanvasContext.isWorkspaceOpen = false
  mockCanvasContext.legacyNotice = null
  mockCanvasContext.guestCanvasToken = null
  mockCanvasContext.pendingWorkspace = null
  mockCanvasContext.compileProgress = null
  mockCanvasContext.openCanvasArtifact = vi.fn()
  mockCanvasContext.focusCanvasArtifact = vi.fn()
  mockCanvasContext.openLegacyCanvasNotice = vi.fn()
  mockCanvasContext.closeWorkspace = vi.fn()
  mockCanvasContext.requestCanvasAiUpdate = vi.fn()
  mockCanvasContext.reloadArtifact = vi.fn()
  mockCanvasContext.setGuestCanvasToken = vi.fn()
  mockCanvasContext.setPendingWorkspace = vi.fn()
  mockCanvasContext.clearPendingWorkspace = vi.fn()
  mockCanvasContext.setCompileProgress = vi.fn()
  mockCanvasContext.clearCompileProgress = vi.fn()
  mockCanvasContext.setArtifact = vi.fn()
  mockCanvasContext.updateDraft = vi.fn()
  mockCanvasContext.saveVersion = vi.fn()
  mockCanvasContext.restoreVersion = vi.fn()
  mockCanvasContext.exportHtml = vi.fn()
  mockCanvasContext.viewFullscreen = vi.fn()
}

function resetSidebarContext() {
  mockSidebar.setOpen = vi.fn()
  mockSidebar.setOpenMobile = vi.fn()
  mockSidebar.open = false
  mockSidebar.isMobile = false
}

function makeUseChatReturnValue(messages: UIMessage[] = []) {
  return {
    messages,
    status: 'ready',
    setMessages: vi.fn(),
    stop: vi.fn(),
    sendMessage: vi.fn(),
    regenerate: vi.fn(),
    addToolResult: vi.fn(),
    error: null
  }
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn()
  }),
  useParams: () => ({})
}))

vi.mock('@ai-sdk/react', () => ({
  useChat: (...args: unknown[]) => mockUseChat(...args)
}))

vi.mock('ai', () => ({
  DefaultChatTransport: class DefaultChatTransport {}
}))

vi.mock('sonner', () => ({
  toast: Object.assign(mockToast, {
    error: mockToastError
  })
}))

vi.mock('@/hooks/use-file-dropzone', () => ({
  useFileDropzone: () => ({
    isDragging: false,
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn()
  })
}))

vi.mock('@/hooks/use-voice-conversation', () => ({
  useVoiceConversation: () => mockUseVoiceConversation()
}))

vi.mock('./chat-messages', () => ({
  ChatMessages: (props: unknown) => {
    mockChatMessages(props)
    return null
  }
}))

vi.mock('./chat-panel', () => ({
  ChatPanel: () => null
}))

vi.mock('./drag-overlay', () => ({
  DragOverlay: () => null
}))

vi.mock('./error-modal', () => ({
  ErrorModal: () => null
}))

vi.mock('./voice/voice-orb', () => ({
  VoiceOrb: () => null
}))

vi.mock('./voice/voice-settings', () => ({
  loadVoiceConfig: () => ({})
}))

vi.mock('./canvas/canvas-context', async () => {
  const actual = await vi.importActual<
    typeof import('./canvas/canvas-context')
  >('./canvas/canvas-context')

  return {
    ...actual,
    useCanvas: () => mockCanvasContext
  }
})

// Old artifact onData handler tests removed — that dispatch path
// no longer exists. Canvas data parts use the canvas context instead.

// --- Canvas migration-regression tests ---

// Mock the sidebar context required by ChatCanvasShell (used internally by CanvasRoot)
vi.mock('./ui/sidebar', () => ({
  useSidebar: () => mockSidebar
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false
}))

// Mock InspectorPanel / InspectorDrawer to avoid pulling in heavy component
// trees with additional unrelated dependencies (e.g., ArtifactContent).
vi.mock('@/components/inspector/inspector-panel', () => ({
  InspectorPanel: () => null
}))
vi.mock('@/components/inspector/inspector-drawer', () => ({
  InspectorDrawer: () => null
}))

// Stub ResizeObserver which is not available in jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

beforeEach(() => {
  resetCanvasContext()
  resetSidebarContext()
  mockUseChat.mockReset()
  mockUseVoiceConversation.mockReset()
  mockChatMessages.mockClear()
  mockToast.mockReset()
  mockToastError.mockReset()
  mockUseVoiceConversation.mockReturnValue({
    stopVoice: vi.fn(),
    voiceState: 'idle',
    isVoiceActive: false,
    startVoice: vi.fn(),
    interimTranscript: '',
    mediaStream: null,
    audioElement: null,
    voiceError: null,
    voiceNotice: null
  })
})

describe('Canvas namespace — Stage 1 migration regression', () => {
  it('mounts CanvasRoot with the preserved chat shell but without artifact runtime state', () => {
    render(
      <CanvasRoot>
        <div>chat</div>
      </CanvasRoot>
    )

    // Children render in both desktop and mobile layout slots
    const chatElements = screen.getAllByText('chat')
    expect(chatElements.length).toBeGreaterThanOrEqual(1)
    expect(chatElements[0]).toBeInTheDocument()
  })

  it('maps legacy artifact references to legacy notice state', () => {
    expect(
      buildLegacyCanvasNotice({
        artifactId: 'legacy-artifact-1',
        source: 'chat-history'
      }).kind
    ).toBe('legacy-unavailable')
  })

  it('preserves all fields in the legacy notice', () => {
    const notice = buildLegacyCanvasNotice({
      artifactId: 'abc-123',
      source: 'public-link'
    })

    expect(notice).toEqual({
      kind: 'legacy-unavailable',
      artifactId: 'abc-123',
      source: 'public-link'
    })
  })

  it('handles guest-token source in legacy notice', () => {
    const notice = buildLegacyCanvasNotice({
      artifactId: 'guest-artifact-1',
      source: 'guest-token'
    })

    expect(notice.kind).toBe('legacy-unavailable')
    expect(notice.source).toBe('guest-token')
  })
})

// --- Canvas chat integration tests ---

describe('Canvas guest token extraction', () => {
  function makeMessage(role: 'user' | 'assistant', parts: any[]): UIMessage {
    return {
      id: `msg-${Math.random().toString(36).slice(2)}`,
      role,
      parts
    }
  }

  it('extracts guestCanvasToken from data-canvasArtifactStatus parts', () => {
    const messages: UIMessage[] = [
      makeMessage('user', [{ type: 'text', text: 'make an app' }]),
      makeMessage('assistant', [
        { type: 'text', text: 'Creating your app...' },
        {
          type: 'data-canvasArtifactStatus',
          data: {
            artifactId: 'art-1',
            chatId: 'chat-1',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: null,
            updatedAt: '2026-03-19T00:00:00Z',
            guestCanvasToken: 'guest-token-abc'
          }
        }
      ])
    ]

    expect(getLatestGuestCanvasToken(messages)).toBe('guest-token-abc')
  })

  it('returns the latest token when multiple status parts exist', () => {
    const messages: UIMessage[] = [
      makeMessage('assistant', [
        {
          type: 'data-canvasArtifactStatus',
          data: {
            artifactId: 'art-1',
            chatId: 'chat-1',
            status: 'compiling',
            draftRevision: 1,
            currentVersionId: null,
            updatedAt: '2026-03-19T00:00:00Z',
            guestCanvasToken: 'old-token'
          }
        }
      ]),
      makeMessage('assistant', [
        {
          type: 'data-canvasArtifactStatus',
          data: {
            artifactId: 'art-1',
            chatId: 'chat-1',
            status: 'ready',
            draftRevision: 2,
            currentVersionId: null,
            updatedAt: '2026-03-19T01:00:00Z',
            guestCanvasToken: 'new-token'
          }
        }
      ])
    ]

    expect(getLatestGuestCanvasToken(messages)).toBe('new-token')
  })

  it('returns undefined when no status parts have a guestCanvasToken', () => {
    const messages: UIMessage[] = [
      makeMessage('user', [{ type: 'text', text: 'hello' }]),
      makeMessage('assistant', [{ type: 'text', text: 'world' }])
    ]

    expect(getLatestGuestCanvasToken(messages)).toBeUndefined()
  })

  it('returns undefined for empty messages', () => {
    expect(getLatestGuestCanvasToken([])).toBeUndefined()
  })
})

describe('buildChatRequestBody with guestCanvasToken', () => {
  function makeMessages(count: number): UIMessage[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `msg-${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: `message ${i}` }]
    }))
  }

  it('includes guestCanvasToken in submit-message body when provided', () => {
    const messages = makeMessages(1)
    const result = buildChatRequestBody({
      messages,
      trigger: 'submit-message',
      messageId: undefined,
      chatId: 'chat-1',
      isGuest: false,
      savedMessagesCount: 0,
      guestCanvasToken: 'canvas-token-123'
    })

    expect(result.body).toHaveProperty('guestCanvasToken', 'canvas-token-123')
  })

  it('does not include guestCanvasToken when not provided', () => {
    const messages = makeMessages(1)
    const result = buildChatRequestBody({
      messages,
      trigger: 'submit-message',
      messageId: undefined,
      chatId: 'chat-1',
      isGuest: false,
      savedMessagesCount: 0
    })

    expect(result.body).not.toHaveProperty('guestCanvasToken')
  })

  it('includes guestCanvasToken in regenerate-message body when provided', () => {
    const messages = makeMessages(2)
    const result = buildChatRequestBody({
      messages,
      trigger: 'regenerate-message',
      messageId: 'msg-0',
      chatId: 'chat-1',
      isGuest: false,
      savedMessagesCount: 0,
      guestCanvasToken: 'canvas-token-regen'
    })

    expect(result.body).toHaveProperty('guestCanvasToken', 'canvas-token-regen')
  })
})

describe('Canvas workspace handoff from chat stream', () => {
  it('closes the mobile sidebar sheet when a streamed canvas artifact opens', async () => {
    resetCanvasContext()
    resetSidebarContext()
    mockSidebar.isMobile = true

    mockUseChat.mockReturnValue(
      makeUseChatReturnValue([
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'data-canvasArtifact',
              data: {
                artifactId: 'art-1',
                chatId: 'chat-1',
                title: 'Canvas',
                status: 'ready',
                draftRevision: 1,
                currentVersionId: null
              }
            }
          ]
        }
      ])
    )

    const { Chat } = await import('./chat')

    render(<Chat savedMessages={[]} />)

    await waitFor(() => {
      expect(mockSidebar.setOpenMobile).toHaveBeenCalledWith(false)
      expect(mockSidebar.setOpen).not.toHaveBeenCalled()
    })
  })

  it('passes the fresh guest token when opening a streamed canvas artifact', async () => {
    resetCanvasContext()

    mockUseChat.mockReturnValue(
      makeUseChatReturnValue([
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'data-canvasArtifactStatus',
              data: {
                artifactId: 'art-1',
                chatId: 'chat-1',
                status: 'ready',
                draftRevision: 1,
                currentVersionId: null,
                updatedAt: '2026-03-19T00:00:00Z',
                guestCanvasToken: 'guest-token-abc'
              }
            },
            {
              type: 'data-canvasArtifact',
              data: {
                artifactId: 'art-1',
                chatId: 'chat-1',
                title: 'Canvas',
                status: 'ready',
                draftRevision: 1,
                currentVersionId: null
              }
            }
          ]
        }
      ])
    )

    const { Chat } = await import('./chat')

    render(<Chat savedMessages={[]} isGuest />)

    await waitFor(() => {
      expect(mockSidebar.setOpen).not.toHaveBeenCalled()
      expect(mockCanvasContext.setGuestCanvasToken).toHaveBeenCalledWith(
        'guest-token-abc'
      )
      expect(mockCanvasContext.openCanvasArtifact).toHaveBeenCalledWith(
        'art-1',
        'guest-token-abc'
      )
    })
  })

  it('waits to auto-open a guest artifact until a guest token is available', async () => {
    resetCanvasContext()

    mockUseChat.mockReturnValue(
      makeUseChatReturnValue([
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'data-canvasArtifact',
              data: {
                artifactId: 'art-1',
                chatId: 'chat-1',
                title: 'Canvas',
                status: 'ready',
                draftRevision: 1,
                currentVersionId: null
              }
            }
          ]
        }
      ])
    )

    const { Chat } = await import('./chat')

    render(<Chat savedMessages={[]} isGuest />)

    await waitFor(() => {
      expect(mockCanvasContext.openCanvasArtifact).not.toHaveBeenCalled()
    })
  })

  it('uses a guest token even when the status part arrives after the artifact part', async () => {
    resetCanvasContext()

    mockUseChat.mockReturnValue(
      makeUseChatReturnValue([
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'data-canvasArtifact',
              data: {
                artifactId: 'art-1',
                chatId: 'chat-1',
                title: 'Canvas',
                status: 'ready',
                draftRevision: 1,
                currentVersionId: null
              }
            },
            {
              type: 'data-canvasArtifactStatus',
              data: {
                artifactId: 'art-1',
                chatId: 'chat-1',
                status: 'ready',
                draftRevision: 1,
                currentVersionId: null,
                updatedAt: '2026-03-19T00:00:00Z',
                guestCanvasToken: 'guest-token-late'
              }
            }
          ]
        }
      ])
    )

    const { Chat } = await import('./chat')

    render(<Chat savedMessages={[]} isGuest />)

    await waitFor(() => {
      expect(mockCanvasContext.setGuestCanvasToken).toHaveBeenCalledWith(
        'guest-token-late'
      )
      expect(mockCanvasContext.openCanvasArtifact).toHaveBeenCalledWith(
        'art-1',
        'guest-token-late'
      )
    })
  })

  it('deduplicates auto-open when the same artifact appears in multiple messages', async () => {
    resetCanvasContext()

    mockUseChat.mockReturnValue(
      makeUseChatReturnValue([
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'data-canvasArtifact',
              data: {
                artifactId: 'art-1',
                chatId: 'chat-1',
                title: 'Canvas',
                status: 'ready',
                draftRevision: 1,
                currentVersionId: null
              }
            }
          ]
        },
        {
          id: 'assistant-2',
          role: 'assistant',
          parts: [
            {
              type: 'data-canvasArtifact',
              data: {
                artifactId: 'art-1',
                chatId: 'chat-1',
                title: 'Canvas',
                status: 'ready',
                draftRevision: 1,
                currentVersionId: null
              }
            }
          ]
        }
      ])
    )

    const { Chat } = await import('./chat')

    render(<Chat savedMessages={[]} />)

    await waitFor(() => {
      expect(mockCanvasContext.openCanvasArtifact).toHaveBeenCalledTimes(1)
      expect(mockCanvasContext.openCanvasArtifact).toHaveBeenCalledWith(
        'art-1',
        undefined
      )
    })
  })

  it('routes transient compile-progress events through useChat onData', async () => {
    let capturedOptions: Record<string, any> | undefined
    mockUseChat.mockImplementation((options: Record<string, any>) => {
      capturedOptions = options
      return makeUseChatReturnValue()
    })

    const { Chat } = await import('./chat')
    render(<Chat savedMessages={[]} />)

    await act(async () => {
      capturedOptions?.onData?.({
        type: 'data-canvasArtifactEvent',
        transient: true,
        data: {
          artifactId: 'art-pending',
          event: 'compile-progress',
          payload: {
            artifactId: 'art-pending',
            title: 'Canvas Artifact',
            source: 'create',
            startedAt: '2026-03-28T23:00:00.000Z',
            steps: [
              {
                id: 'validate',
                label: 'Validating source',
                status: 'in-progress'
              },
              {
                id: 'bundle',
                label: 'Building React components',
                status: 'pending'
              },
              {
                id: 'tailwind',
                label: 'Compiling Tailwind styles',
                status: 'pending'
              },
              {
                id: 'assemble',
                label: 'Bundling output',
                status: 'pending'
              }
            ]
          }
        }
      })
    })

    expect(mockCanvasContext.setPendingWorkspace).toHaveBeenCalledWith({
      artifactId: 'art-pending',
      title: 'Canvas Artifact'
    })
    expect(mockCanvasContext.setCompileProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'art-pending',
        source: 'create'
      })
    )
  })

  it('reconciles persisted artifact status updates into the open canvas artifact state', async () => {
    resetCanvasContext()
    mockCanvasContext.artifactId = 'art-1'
    mockCanvasContext.artifact = {
      artifactId: 'art-1',
      chatId: 'chat-1',
      title: 'Canvas',
      status: 'generating',
      draftRevision: 1,
      draftSource: { 'App.tsx': 'export default () => <div>Hello</div>' },
      draftCompiledHtml: '<html></html>',
      draftDiagnostics: null,
      currentVersionId: null,
      versions: [],
      updatedAt: '2026-03-28T22:00:00.000Z'
    }
    mockUseChat.mockReturnValue(
      makeUseChatReturnValue([
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'data-canvasArtifactStatus',
              data: {
                artifactId: 'art-1',
                chatId: 'chat-1',
                status: 'compile_failed',
                draftRevision: 2,
                currentVersionId: null,
                updatedAt: '2026-03-28T22:05:00.000Z'
              }
            }
          ]
        }
      ])
    )

    const { Chat } = await import('./chat')
    render(<Chat savedMessages={[]} />)

    await waitFor(() => {
      expect(mockCanvasContext.setArtifact).toHaveBeenCalledWith(
        expect.objectContaining({
          artifactId: 'art-1',
          status: 'compile_failed',
          draftRevision: 2
        })
      )
    })
  })
})

describe('Chat route sync', () => {
  it('resyncs the internal chatId when the route id prop changes', async () => {
    mockUseChat.mockImplementation(() => makeUseChatReturnValue())

    const { Chat } = await import('./chat')

    const { rerender } = render(<Chat id="chat-a" savedMessages={[]} />)

    rerender(<Chat id="chat-b" savedMessages={[]} />)

    await waitFor(() => {
      expect(mockUseChat.mock.calls.at(-1)?.[0]).toMatchObject({ id: 'chat-b' })
      expect(mockChatMessages.mock.calls.at(-1)?.[0]).toMatchObject({
        chatId: 'chat-b'
      })
    })
  })
})

describe('Chat sections', () => {
  it('deduplicates assistant messages with the same id within a section', async () => {
    mockUseChat.mockReturnValue(
      makeUseChatReturnValue([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Update the canvas' }]
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Working on it' }]
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Working on it' }]
        }
      ])
    )

    const { Chat } = await import('./chat')

    render(<Chat savedMessages={[]} />)

    const lastCall = mockChatMessages.mock.calls.at(-1)?.[0] as
      | { sections?: Array<{ assistantMessages: UIMessage[] }> }
      | undefined

    expect(lastCall?.sections).toHaveLength(1)
    expect(lastCall?.sections?.[0]?.assistantMessages).toHaveLength(1)
  })
})

describe('Chat voice toasts', () => {
  it('shows a toast error when voice mode reports a voice error', async () => {
    mockUseChat.mockReturnValue(makeUseChatReturnValue())
    mockUseVoiceConversation.mockReturnValue({
      stopVoice: vi.fn(),
      voiceState: 'idle',
      isVoiceActive: false,
      startVoice: vi.fn(),
      interimTranscript: '',
      mediaStream: null,
      audioElement: null,
      voiceError: {
        code: 'tts-timeout',
        message: 'Voice synthesis timed out. Please try again.'
      },
      voiceNotice: null
    })

    const { Chat } = await import('./chat')

    render(<Chat savedMessages={[]} />)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Voice synthesis timed out. Please try again.'
      )
    })
  })

  it('shows a toast notice when voice mode reports a provider fallback', async () => {
    mockUseChat.mockReturnValue(makeUseChatReturnValue())
    mockUseVoiceConversation.mockReturnValue({
      stopVoice: vi.fn(),
      voiceState: 'idle',
      isVoiceActive: false,
      startVoice: vi.fn(),
      interimTranscript: '',
      mediaStream: null,
      audioElement: null,
      voiceError: null,
      voiceNotice: {
        code: 'provider-fallback',
        message: 'Voice fallback: switched to OpenAI.'
      }
    })

    const { Chat } = await import('./chat')

    render(<Chat savedMessages={[]} />)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        'Voice fallback: switched to OpenAI.'
      )
    })
  })
})
