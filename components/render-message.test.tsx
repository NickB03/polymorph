import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import { RenderMessage } from './render-message'

const { mockResearchProcessSection } = vi.hoisted(() => ({
  mockResearchProcessSection: vi.fn((_props: Record<string, unknown>) => null)
}))

vi.mock('./answer-section', () => ({
  AnswerSection: ({
    content,
    showActions
  }: {
    content: string
    showActions?: boolean
  }) => (
    <div
      data-show-actions={showActions ? 'true' : 'false'}
      data-testid="answer-section"
    >
      {content}
    </div>
  )
}))

vi.mock('./dynamic-tool-display', () => ({
  DynamicToolDisplay: ({
    part
  }: {
    part: {
      toolName: string
      state: string
      output?: unknown
      errorText?: string
    }
  }) => {
    if (part.state === 'output-available') {
      if (part.toolName === 'readCanvasArtifact') {
        const output =
          part.output && typeof part.output === 'object'
            ? (part.output as Record<string, unknown>)
            : {}
        if (
          output.status === 'not_found' ||
          typeof output.error === 'string' ||
          typeof output.errorCode === 'string'
        ) {
          return (
            <div data-testid="dynamic-tool-display">
              {JSON.stringify(part.output)}
            </div>
          )
        }

        return <div data-testid="canvas-artifact-card" data-source="tool" />
      }

      if (part.toolName === 'createCanvasArtifact') {
        return <div data-testid="canvas-artifact-card" data-source="tool" />
      }
    }

    if (part.state === 'output-error') {
      return <div data-testid="dynamic-tool-display">{part.errorText}</div>
    }

    return null
  }
}))

vi.mock('./message-actions', () => ({
  MessageActions: () => <div data-testid="message-actions" />
}))

vi.mock('./research-plan', () => ({
  ResearchPlan: () => null
}))

vi.mock('./research-process-section', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockResearchProcessSection(props)
}))

vi.mock('./research-status-line', () => ({
  ResearchStatusLine: () => null
}))

vi.mock('./tool-ui/canvas-artifact-card', () => ({
  CanvasArtifactCard: ({
    onClick,
    data
  }: {
    data: { artifactId: string; title?: string; status?: string }
    onClick?: () => void
  }) => (
    <div
      data-testid="canvas-artifact-card"
      data-artifact-id={data.artifactId}
      data-title={data.title}
      data-status={data.status}
      onClick={onClick}
    />
  ),
  tryParseCanvasArtifactCardData: (output: unknown) => {
    if (!output || typeof output !== 'object') return null
    const data = output as Record<string, unknown>
    if (
      typeof data.artifactId !== 'string' ||
      typeof data.chatId !== 'string' ||
      typeof data.status !== 'string'
    ) {
      return null
    }
    return {
      artifactId: data.artifactId,
      chatId: data.chatId,
      title: typeof data.title === 'string' ? data.title : 'Canvas Artifact',
      status: data.status,
      draftRevision:
        typeof data.draftRevision === 'number' ? data.draftRevision : 0,
      currentVersionId:
        typeof data.currentVersionId === 'string' ? data.currentVersionId : null
    }
  }
}))

vi.mock('./tool-ui/option-list/option-list', () => ({
  OptionList: () => null
}))

vi.mock('./tool-ui/option-list/schema', () => ({
  safeParseSerializableOptionList: () => null
}))

vi.mock('./tool-ui/question-wizard/question-wizard', () => ({
  QuestionWizard: ({
    choice,
    id
  }: {
    choice?: Record<string, unknown>
    id: string
  }) =>
    choice != null ? (
      <div
        data-testid="question-wizard-receipt"
        data-receipt="true"
        data-tool-ui-id={id}
        role="status"
      >
        Wizard receipt
      </div>
    ) : (
      <div data-testid="question-wizard-interactive" data-tool-ui-id={id}>
        Wizard interactive
      </div>
    )
}))

vi.mock('./tool-ui/registry', () => {
  const registeredToolNames = new Set([
    'displayPlan',
    'displayTable',
    'competitorResearch',
    'displayChart',
    'displayGeoMap',
    'displayCitations',
    'displayLinkPreview',
    'displayAgentArtifact',
    'displayOptionList',
    'displayQuestionWizard',
    'displayCallout',
    'displayTimeline',
    'generateImage',
    'createCanvasArtifact',
    'updateCanvasArtifact'
  ])
  return {
    isRegisteredToolUI: (toolName: string) => registeredToolNames.has(toolName),
    tryRenderToolUI: (output: unknown) => {
      if (
        output &&
        typeof output === 'object' &&
        typeof (output as Record<string, unknown>).id === 'string' &&
        typeof (output as Record<string, unknown>).title === 'string' &&
        Array.isArray((output as Record<string, unknown>).events)
      ) {
        return <div data-testid="timeline-tool-ui" data-source="json" />
      }

      return null
    },
    tryRenderToolUIByName: (
      toolName: string,
      output: unknown,
      partId: string
    ) => {
      if (
        toolName === 'displayAgentArtifact' &&
        output &&
        typeof output === 'object' &&
        typeof (output as Record<string, unknown>).id === 'string' &&
        typeof (output as Record<string, unknown>).title === 'string' &&
        typeof (output as Record<string, unknown>).content === 'string'
      ) {
        return (
          <div data-testid="agent-artifact-tool-ui" data-part-id={partId} />
        )
      }

      if (
        toolName === 'displayTimeline' &&
        output &&
        typeof output === 'object' &&
        typeof (output as Record<string, unknown>).id === 'string' &&
        typeof (output as Record<string, unknown>).title === 'string' &&
        Array.isArray((output as Record<string, unknown>).events)
      ) {
        return <div data-testid="timeline-tool-ui" data-source="tool" />
      }

      if (
        toolName === 'competitorResearch' &&
        output &&
        typeof output === 'object' &&
        typeof (output as Record<string, unknown>).summary === 'string' &&
        Array.isArray((output as Record<string, unknown>).cards) &&
        Array.isArray((output as Record<string, unknown>).matrix)
      ) {
        return (
          <div
            data-testid="competitor-research-tool-ui"
            data-part-id={partId}
          />
        )
      }

      if (
        (toolName === 'createCanvasArtifact' ||
          toolName === 'updateCanvasArtifact' ||
          toolName === 'readCanvasArtifact') &&
        output &&
        typeof output === 'object'
      ) {
        const data = output as Record<string, unknown>
        if (
          typeof data.artifactId === 'string' &&
          typeof data.chatId === 'string' &&
          typeof data.title === 'string' &&
          typeof data.status === 'string'
        ) {
          return <div data-testid="canvas-artifact-card" data-source="tool" />
        }
      }

      if (
        toolName === 'generateImage' &&
        output &&
        typeof output === 'object' &&
        typeof (output as Record<string, unknown>).imageUrl === 'string'
      ) {
        return (
          <div data-testid="generate-image-tool-ui" data-part-id={partId} />
        )
      }

      return null
    }
  }
})

vi.mock('./user-file-section', () => ({
  UserFileSection: () => null
}))

vi.mock('./user-text-section', () => ({
  UserTextSection: () => null
}))

describe('RenderMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    mockResearchProcessSection.mockClear()
  })

  it('does not emit a React key warning for suppressed research sidebar tools', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'Answer'
        },
        {
          type: 'tool-displayCitations',
          state: 'output-available',
          output: { citations: [] }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
        isResearchMode
      />
    )

    const keyWarnings = consoleError.mock.calls.filter(([value]) =>
      String(value).includes(
        'Each child in a list should have a unique "key" prop'
      )
    )

    expect(keyWarnings).toHaveLength(0)
  })

  it('merges text parts separated only by hidden canvas status updates', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: '## Modern Tech Landing Page\n\nHere is your landing page.'
        },
        {
          type: 'data-canvasArtifactStatus',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            status: 'generating',
            draftRevision: 1,
            currentVersionId: null,
            updatedAt: '2026-03-23T12:00:00.000Z'
          }
        } as any,
        {
          type: 'text',
          text: '## Modern Tech Landing Page\n\nHere is your landing page with a polished hero and FAQ.'
        }
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    const sections = screen.getAllByTestId('answer-section')

    expect(sections).toHaveLength(1)
    expect(sections[0]).toHaveTextContent(
      'Here is your landing page with a polished hero and FAQ.'
    )
  })

  it('renders dynamic canvas output and persisted artifact data independently', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolCallId: 'tool-1',
          toolName: 'createCanvasArtifact',
          state: 'output-available',
          input: {
            title: 'Modern Tech Landing Page'
          },
          output: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'Modern Tech Landing Page',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any,
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'Modern Tech Landing Page',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getAllByTestId('canvas-artifact-card')).toHaveLength(2)
  })

  it('does not render readCanvasArtifact output as a duplicate canvas card during updates', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-readCanvasArtifact',
          state: 'output-available',
          toolCallId: 'read-1',
          output: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'Phoenix Pro Project Tracker Dashboard',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: 'version-1',
            files: [
              {
                path: 'app/page.tsx',
                content: 'export default function Page() {}'
              }
            ]
          }
        } as any,
        {
          type: 'data-canvasArtifactStatus',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'Phoenix Pro Project Tracker Dashboard',
            status: 'compiling',
            draftRevision: 2,
            currentVersionId: 'version-1',
            updatedAt: '2026-04-26T03:00:00.000Z'
          }
        } as any,
        {
          type: 'tool-updateCanvasArtifact',
          state: 'output-available',
          toolCallId: 'update-1',
          output: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'Phoenix Pro Project Tracker Dashboard',
            status: 'ready',
            draftRevision: 2,
            currentVersionId: 'version-2'
          }
        } as any,
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'Phoenix Pro Project Tracker Dashboard',
            status: 'ready',
            draftRevision: 2,
            currentVersionId: 'version-2'
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    const cards = screen.getAllByTestId('canvas-artifact-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('data-artifact-id', 'artifact-1')
    expect(cards[0]).toHaveAttribute(
      'data-title',
      'Phoenix Pro Project Tracker Dashboard'
    )
    expect(cards[0]).toHaveAttribute('data-status', 'ready')
  })

  it('does not render dynamic readCanvasArtifact output as a duplicate canvas card', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolCallId: 'read-1',
          toolName: 'readCanvasArtifact',
          state: 'output-available',
          input: { artifactId: 'artifact-1' },
          output: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'Phoenix Pro Project Tracker Dashboard',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: 'version-1',
            files: [
              {
                path: 'app/page.tsx',
                content: 'export default function Page() {}'
              }
            ]
          }
        } as any,
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'Phoenix Pro Project Tracker Dashboard Updated',
            status: 'ready',
            draftRevision: 2,
            currentVersionId: 'version-2'
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    const cards = screen.getAllByTestId('canvas-artifact-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute(
      'data-title',
      'Phoenix Pro Project Tracker Dashboard Updated'
    )
  })

  it('renders readCanvasArtifact not_found output instead of hiding it', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-readCanvasArtifact',
          state: 'output-available',
          toolCallId: 'read-1',
          input: { artifactId: 'missing-artifact' },
          output: {
            artifactId: 'missing-artifact',
            chatId: 'chat-1',
            title: '',
            status: 'not_found',
            draftRevision: 0,
            currentVersionId: null,
            files: {},
            error: 'Artifact not found',
            errorCode: 'not-found'
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.queryByTestId('canvas-artifact-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('dynamic-tool-display')).toHaveTextContent(
      'Artifact not found'
    )
  })

  it('renders dynamic-tool readCanvasArtifact not_found output instead of hiding it', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolCallId: 'read-1',
          toolName: 'readCanvasArtifact',
          state: 'output-available',
          input: { artifactId: 'missing-artifact' },
          output: {
            artifactId: 'missing-artifact',
            chatId: 'chat-1',
            title: '',
            status: 'not_found',
            draftRevision: 0,
            currentVersionId: null,
            files: {},
            error: 'Artifact not found',
            errorCode: 'not-found'
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.queryByTestId('canvas-artifact-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('dynamic-tool-display')).toHaveTextContent(
      'Artifact not found'
    )
  })

  it('renders readCanvasArtifact output-error output instead of hiding it', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-readCanvasArtifact',
          state: 'output-error',
          toolCallId: 'read-1',
          input: { artifactId: 'artifact-1' },
          errorText: 'Read failed'
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.queryByTestId('canvas-artifact-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('dynamic-tool-display')).toHaveTextContent(
      'Read failed'
    )
  })

  it('renders dynamic-tool readCanvasArtifact output-error output instead of hiding it', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolCallId: 'read-1',
          toolName: 'readCanvasArtifact',
          state: 'output-error',
          input: { artifactId: 'artifact-1' },
          errorText: 'Dynamic read failed'
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.queryByTestId('canvas-artifact-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('dynamic-tool-display')).toHaveTextContent(
      'Dynamic read failed'
    )
  })

  it('calls onCanvasArtifactClick when a data-canvasArtifact card is clicked', () => {
    const handleClick = vi.fn()
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'My Artifact',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
        onCanvasArtifactClick={handleClick}
      />
    )

    fireEvent.click(screen.getByTestId('canvas-artifact-card'))
    expect(handleClick).toHaveBeenCalledWith('artifact-1')
  })

  it('renders clickable dynamic canvas artifact cards when no data part exists', () => {
    const handleClick = vi.fn()
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolCallId: 'tool-1',
          toolName: 'createCanvasArtifact',
          state: 'output-available',
          input: { title: 'My Artifact' },
          output: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
        onCanvasArtifactClick={handleClick}
      />
    )

    const card = screen.getByTestId('canvas-artifact-card')
    expect(card).toBeInTheDocument()
    fireEvent.click(card)
    expect(handleClick).toHaveBeenCalledWith('artifact-1')
  })

  it('suppresses tool-createCanvasArtifact when data-canvasArtifact exists for the same artifact', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-createCanvasArtifact',
          state: 'output-available',
          toolCallId: 'tool-1',
          toolName: 'createCanvasArtifact',
          output: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any,
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'My Artifact',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getAllByTestId('canvas-artifact-card')).toHaveLength(1)
  })

  it('renders a clickable card from tool-createCanvasArtifact when no data part exists', () => {
    const handleClick = vi.fn()
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-createCanvasArtifact',
          state: 'output-available',
          toolCallId: 'tool-1',
          toolName: 'createCanvasArtifact',
          output: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
        onCanvasArtifactClick={handleClick}
      />
    )

    const card = screen.getByTestId('canvas-artifact-card')
    expect(card).toBeInTheDocument()
    fireEvent.click(card)
    expect(handleClick).toHaveBeenCalledWith('artifact-1')
  })

  it('suppresses tool-createCanvasArtifact cards with empty artifactId (failed compile before DB insert)', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-createCanvasArtifact',
          state: 'output-available',
          toolCallId: 'tool-1',
          toolName: 'createCanvasArtifact',
          output: {
            artifactId: '',
            chatId: 'chat-1',
            status: 'compile_failed',
            draftRevision: 0,
            currentVersionId: null,
            error: 'Compilation failed'
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.queryByTestId('canvas-artifact-card')).not.toBeInTheDocument()
  })

  it('delegates dynamic-tool canvas outputs with empty artifactId to DynamicToolDisplay', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolCallId: 'tool-1',
          toolName: 'createCanvasArtifact',
          state: 'output-available',
          input: { title: 'Test' },
          output: {
            artifactId: '',
            chatId: 'chat-1',
            status: 'compile_failed',
            draftRevision: 0,
            currentVersionId: null
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getByTestId('canvas-artifact-card')).toBeInTheDocument()
  })

  it('passes isLatestMessage through to ResearchProcessSection', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'reasoning',
          text: 'Researching'
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
        isLatestMessage
      />
    )

    expect(mockResearchProcessSection).toHaveBeenCalled()
    const researchProcessProps =
      mockResearchProcessSection.mock.calls.at(0)?.[0]
    expect(researchProcessProps).toBeDefined()
    expect(researchProcessProps).toMatchObject({
      isLatestMessage: true
    })
  })

  it('renders displayTimeline tool output inline through the tool UI registry', () => {
    const message: UIMessage = {
      id: 'assistant-timeline-tool',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: '## Recent Milestones\n\nHere is the timeline:'
        },
        {
          type: 'tool-displayTimeline',
          toolCallId: 'timeline-tool-1',
          state: 'output-available',
          output: {
            id: 'recent-milestones',
            title: 'Recent Milestones',
            events: [
              {
                id: 'launch',
                date: '2025',
                title: 'Launch'
              }
            ]
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getByTestId('timeline-tool-ui')).toHaveAttribute(
      'data-source',
      'tool'
    )
  })

  it('renders displayAgentArtifact output after canonical message reload', () => {
    const message: UIMessage = {
      id: 'assistant-agent-artifact-tool',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'Here is the inline artifact:'
        },
        {
          type: 'tool-displayAgentArtifact',
          toolCallId: 'artifact-tool-1',
          state: 'output-available',
          input: {
            id: 'artifact-1',
            title: 'API Schema',
            artifactType: 'code',
            content: 'export const schema = {}'
          },
          output: {
            id: 'artifact-1',
            title: 'API Schema',
            artifactType: 'code',
            content: 'export const schema = {}'
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getByTestId('agent-artifact-tool-ui')).toHaveAttribute(
      'data-part-id',
      'artifact-tool-1'
    )
  })

  it('renders completed registered non-display tool output through the tool UI registry instead of the research process buffer', () => {
    const message: UIMessage = {
      id: 'assistant-competitor-research-tool',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'Competitive analysis is ready.'
        },
        {
          type: 'tool-competitorResearch',
          toolCallId: 'competitor-tool-1',
          state: 'output-available',
          output: {
            summary: 'Alpha is stronger on reach; Beta is stronger on trust.',
            cards: [
              {
                competitor: 'Alpha',
                strengths: ['Reach'],
                weaknesses: ['Trust']
              },
              {
                competitor: 'Beta',
                strengths: ['Trust'],
                weaknesses: ['Reach']
              }
            ],
            matrix: [
              {
                competitor: 'Alpha',
                reach: 'High',
                trust: 'Medium'
              },
              {
                competitor: 'Beta',
                reach: 'Medium',
                trust: 'High'
              }
            ]
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getByTestId('competitor-research-tool-ui')).toHaveAttribute(
      'data-part-id',
      'competitor-tool-1'
    )
    expect(
      mockResearchProcessSection.mock.calls.some(([props]) =>
        (props.parts as UIMessage['parts'] | undefined)?.some(
          part => part.type === 'tool-competitorResearch'
        )
      )
    ).toBe(false)
  })

  it('places message actions after trailing registered tool UI', () => {
    const message: UIMessage = {
      id: 'assistant-actions-after-tool-ui',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'Competitive analysis is ready.'
        },
        {
          type: 'tool-competitorResearch',
          toolCallId: 'competitor-tool-1',
          state: 'output-available',
          output: {
            summary: 'Alpha is stronger on reach; Beta is stronger on trust.',
            cards: [
              {
                competitor: 'Alpha',
                strengths: ['Reach'],
                weaknesses: ['Trust']
              },
              {
                competitor: 'Beta',
                strengths: ['Trust'],
                weaknesses: ['Reach']
              }
            ],
            matrix: [
              {
                competitor: 'Alpha',
                reach: 'High',
                trust: 'Medium'
              },
              {
                competitor: 'Beta',
                reach: 'Medium',
                trust: 'High'
              }
            ]
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getByTestId('answer-section')).toHaveAttribute(
      'data-show-actions',
      'false'
    )
    const tool = screen.getByTestId('competitor-research-tool-ui')
    const actions = screen.getByTestId('message-actions')
    expect(
      tool.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('places message actions after display tools deferred until after the first text', () => {
    const message: UIMessage = {
      id: 'assistant-actions-after-deferred-tool-ui',
      role: 'assistant',
      parts: [
        {
          type: 'tool-displayTimeline',
          toolCallId: 'timeline-tool-1',
          state: 'output-available',
          output: {
            id: 'recent-milestones',
            title: 'Recent Milestones',
            events: [
              {
                id: 'launch',
                date: '2025',
                title: 'Launch'
              }
            ]
          }
        } as any,
        {
          type: 'text',
          text: 'Here is the timeline.'
        }
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getByTestId('answer-section')).toHaveAttribute(
      'data-show-actions',
      'false'
    )
    const tool = screen.getByTestId('timeline-tool-ui')
    const actions = screen.getByTestId('message-actions')
    expect(
      tool.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('places message actions after trailing readCanvasArtifact errors', () => {
    const message: UIMessage = {
      id: 'assistant-actions-after-read-error',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'I could not read the canvas artifact.'
        },
        {
          type: 'tool-readCanvasArtifact',
          state: 'output-error',
          toolCallId: 'read-1',
          input: { artifactId: 'artifact-1' },
          errorText: 'Read failed'
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getByTestId('answer-section')).toHaveAttribute(
      'data-show-actions',
      'false'
    )
    const tool = screen.getByTestId('dynamic-tool-display')
    const actions = screen.getByTestId('message-actions')
    expect(
      tool.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('extracts valid fenced JSON timeline payloads from assistant text', () => {
    const message: UIMessage = {
      id: 'assistant-timeline-json',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: `## Recent Milestones\n\nHere is the timeline:\n\n\`\`\`json
{"id":"recent-milestones","title":"Recent Milestones","events":[{"id":"launch","date":"2025","title":"Launch"}]}
\`\`\`\n\nThis trajectory accelerated quickly.`
        }
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getByTestId('timeline-tool-ui')).toHaveAttribute(
      'data-source',
      'json'
    )
    expect(screen.queryByText(/"events"/)).not.toBeInTheDocument()
  })

  it('suppresses pseudo display tool placeholder blocks and logs debug context', () => {
    const consoleDebug = vi
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined)

    const message: UIMessage = {
      id: 'assistant-timeline-placeholder',
      role: 'assistant',
      metadata: {
        modelId: 'gateway:google/gemini-3-flash',
        userMode: 'search'
      },
      parts: [
        {
          type: 'text',
          text: `## Recent Milestones Timeline\n\nWaymo's growth has accelerated significantly over the past year:\n\n\`\`\`json
/* displayTimeline tool call */
\`\`\`\n\nThe rollout continued after these milestones.`
        }
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(
      screen.queryByText(/displayTimeline tool call/i)
    ).not.toBeInTheDocument()
    expect(consoleDebug).toHaveBeenCalledWith(
      '[RenderMessage] Suppressed pseudo display tool placeholder',
      expect.objectContaining({
        messageId: 'assistant-timeline-placeholder',
        modelId: 'gateway:google/gemini-3-flash',
        userMode: 'search',
        toolName: 'displayTimeline'
      })
    )
  })

  it('suppresses tool_code display placeholders even when a real tool result exists', () => {
    const consoleDebug = vi
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined)

    const message: UIMessage = {
      id: 'assistant-timeline-tool-code',
      role: 'assistant',
      metadata: {
        modelId: 'gateway:google/gemini-3-flash',
        userMode: 'search'
      },
      parts: [
        {
          type: 'text',
          text: `## Recent Milestones Timeline\n\nWaymo's growth accelerated quickly:\n\n\`\`\`json
/* tool_code */
displayTimeline({
  id: "recent-milestones",
  title: "Recent Milestones",
  events: [{ id: "launch", date: "2025", title: "Launch" }]
})
\`\`\`\n\nThe rollout continued after these milestones.`
        },
        {
          type: 'tool-displayTimeline',
          toolCallId: 'timeline-tool-1',
          state: 'output-available',
          output: {
            id: 'recent-milestones',
            title: 'Recent Milestones',
            events: [
              {
                id: 'launch',
                date: '2025',
                title: 'Launch'
              }
            ]
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.queryByText(/displayTimeline\(/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('timeline-tool-ui')).toHaveAttribute(
      'data-source',
      'tool'
    )
    expect(consoleDebug).toHaveBeenCalledWith(
      '[RenderMessage] Suppressed pseudo display tool placeholder',
      expect.objectContaining({
        messageId: 'assistant-timeline-tool-code',
        toolName: 'displayTimeline',
        hadCompletedDisplayTool: true
      })
    )
  })

  it('suppresses json-comment display tool placeholders followed by fake calls', () => {
    const consoleDebug = vi
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined)

    const message: UIMessage = {
      id: 'assistant-timeline-json-comment-placeholder',
      role: 'assistant',
      metadata: {
        modelId: 'gateway:xai/grok-4.1-fast-non-reasoning',
        userMode: 'search'
      },
      parts: [
        {
          type: 'text',
          text: `## Recent Milestones Timeline\n\nWaymo's growth accelerated quickly:\n\n\`\`\`json
/* { "tool": "displayTimeline" } */
displayTimeline({
  id: "recent-milestones",
  title: "Recent Milestones",
  events: [{ id: "launch", date: "2025", title: "Launch" }]
})
\`\`\`\n\nThe rollout continued after these milestones.`
        }
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.queryByText(/displayTimeline\(/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/"tool": "displayTimeline"/i)
    ).not.toBeInTheDocument()
    expect(screen.getByText(/The rollout continued/i)).toBeInTheDocument()
    expect(consoleDebug).toHaveBeenCalledWith(
      '[RenderMessage] Suppressed pseudo display tool placeholder',
      expect.objectContaining({
        messageId: 'assistant-timeline-json-comment-placeholder',
        toolName: 'displayTimeline',
        matchedPattern: 'fenced-json-comment-function-placeholder'
      })
    )
  })

  it('keeps legitimate code fences that only mention a display tool', () => {
    const message: UIMessage = {
      id: 'assistant-display-tool-code-docs',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: `## Debugging Tool Names\n\nUse a constant when checking tool names:\n\n\`\`\`ts
const toolName = "displayTimeline"
console.log(toolName)
\`\`\`\n\nThis is documentation, not a fake call.`
        }
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getByText(/displayTimeline/i)).toBeInTheDocument()
    expect(screen.getByText(/This is documentation/i)).toBeInTheDocument()
  })

  it('shows only the data-canvasArtifact card when failed creates with empty IDs precede a success', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-createCanvasArtifact',
          state: 'output-available',
          toolCallId: 'tool-1',
          toolName: 'createCanvasArtifact',
          output: {
            artifactId: '',
            chatId: 'chat-1',
            status: 'compile_failed',
            draftRevision: 0,
            currentVersionId: null,
            error: 'Compilation failed'
          }
        } as any,
        {
          type: 'tool-createCanvasArtifact',
          state: 'output-available',
          toolCallId: 'tool-2',
          toolName: 'createCanvasArtifact',
          output: {
            artifactId: '',
            chatId: 'chat-1',
            status: 'compile_failed',
            draftRevision: 0,
            currentVersionId: null,
            error: 'Compilation failed again'
          }
        } as any,
        {
          type: 'tool-createCanvasArtifact',
          state: 'output-available',
          toolCallId: 'tool-3',
          toolName: 'createCanvasArtifact',
          output: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any,
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'Retro Runner Arcade',
            status: 'ready',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    const cards = screen.getAllByTestId('canvas-artifact-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('data-artifact-id', 'artifact-1')
  })

  it('renders only the latest persisted canvas artifact card for a repeated artifactId', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'US Population 2026 Dashboard',
            status: 'generating',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any,
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'US Population 2026 Dashboard (Revised)',
            status: 'ready',
            draftRevision: 2,
            currentVersionId: null
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    const cards = screen.getAllByTestId('canvas-artifact-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('data-artifact-id', 'artifact-1')
    expect(cards[0]).toHaveAttribute(
      'data-title',
      'US Population 2026 Dashboard (Revised)'
    )
  })

  it('renders the latest persisted artifact card when hidden status parts are interleaved', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'US Population 2026 Dashboard',
            status: 'generating',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any,
        {
          type: 'data-canvasArtifactStatus',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            status: 'generating',
            draftRevision: 1,
            currentVersionId: null,
            updatedAt: '2026-03-28T22:00:00.000Z'
          }
        } as any,
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'US Population 2026 Dashboard (Revised)',
            status: 'ready',
            draftRevision: 2,
            currentVersionId: null
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    const cards = screen.getAllByTestId('canvas-artifact-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute('data-artifact-id', 'artifact-1')
    expect(cards[0]).toHaveAttribute(
      'data-title',
      'US Population 2026 Dashboard (Revised)'
    )
  })

  it('does not apply an earlier hidden status to a newer artifact card', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'US Population 2026 Dashboard',
            status: 'generating',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any,
        {
          type: 'data-canvasArtifactStatus',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            status: 'compile_failed',
            draftRevision: 1,
            currentVersionId: null,
            updatedAt: '2026-03-28T22:00:00.000Z'
          }
        } as any,
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'US Population 2026 Dashboard (Revised)',
            status: 'ready',
            draftRevision: 2,
            currentVersionId: null
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getAllByTestId('canvas-artifact-card')).toHaveLength(1)
    expect(screen.getByTestId('canvas-artifact-card')).toHaveAttribute(
      'data-artifact-id',
      'artifact-1'
    )
    expect(screen.getByTestId('canvas-artifact-card')).toHaveAttribute(
      'data-title',
      'US Population 2026 Dashboard (Revised)'
    )
    expect(screen.getByTestId('canvas-artifact-card')).toHaveAttribute(
      'data-status',
      'ready'
    )
  })

  it('reconciles the latest hidden artifact status onto the rendered card', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'data-canvasArtifact',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            title: 'US Population 2026 Dashboard',
            status: 'generating',
            draftRevision: 1,
            currentVersionId: null
          }
        } as any,
        {
          type: 'data-canvasArtifactStatus',
          data: {
            artifactId: 'artifact-1',
            chatId: 'chat-1',
            status: 'compile_failed',
            draftRevision: 2,
            currentVersionId: null,
            updatedAt: '2026-03-28T22:00:00.000Z'
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getByTestId('canvas-artifact-card')).toHaveAttribute(
      'data-status',
      'compile_failed'
    )
  })

  it('does not render legacy-artifact-notice for data-artifact parts (branch removed)', () => {
    const message: UIMessage = {
      id: 'assistant-legacy',
      role: 'assistant',
      parts: [
        {
          type: 'data-artifact',
          data: { id: 'old-artifact-id' }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(
      screen.queryByTestId('legacy-artifact-notice')
    ).not.toBeInTheDocument()
  })

  it('renders tool-generateImage output through registry', () => {
    const message: UIMessage = {
      id: 'assistant-generate-image',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'Here is your generated image:'
        },
        {
          type: 'tool-generateImage',
          toolCallId: 'gen-img-1',
          state: 'output-available',
          output: {
            imageUrl: 'https://example.com/image.png',
            filename: 'image.png',
            mediaType: 'image/png',
            description: 'A beautiful landscape'
          }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(screen.getByTestId('generate-image-tool-ui')).toHaveAttribute(
      'data-part-id',
      'gen-img-1'
    )
  })

  it('renders displayQuestionWizard receipt state on reload (output-available via RenderMessage)', () => {
    const message: UIMessage = {
      id: 'assistant-wizard-reload',
      role: 'assistant',
      parts: [
        {
          type: 'tool-displayQuestionWizard',
          toolCallId: 'wiz-reload-1',
          state: 'output-available',
          input: {
            id: 'project-intake',
            steps: [
              {
                id: 'style',
                title: 'Choose a style',
                options: [
                  { id: 'minimal', label: 'Minimal' },
                  { id: 'editorial', label: 'Editorial' }
                ],
                selectionMode: 'single'
              },
              {
                id: 'tone',
                title: 'Choose a tone',
                options: [
                  { id: 'friendly', label: 'Friendly' },
                  { id: 'formal', label: 'Formal' }
                ],
                selectionMode: 'single'
              }
            ],
            submitLabel: 'Finish'
          },
          output: { style: 'minimal', tone: 'friendly' }
        } as any
      ]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    const receipt = screen.getByTestId('question-wizard-receipt')
    expect(receipt).toBeInTheDocument()
    expect(receipt).toHaveAttribute('data-receipt', 'true')
  })

  it('routes unregistered tool-* output-available parts to ResearchProcessSection (not inline placeholder)', () => {
    const searchPart = {
      type: 'tool-search',
      toolCallId: 'search-1',
      state: 'output-available',
      input: { query: 'foo' },
      output: {
        query: 'foo',
        results: [
          { title: 'r1', url: 'https://example.com/1', content: 'snippet' }
        ]
      }
    }

    const message: UIMessage = {
      id: 'assistant-search',
      role: 'assistant',
      parts: [searchPart as any]
    }

    render(
      <RenderMessage
        message={message}
        messageId={message.id}
        getIsOpen={() => false}
        onOpenChange={() => {}}
        onQuerySelect={() => {}}
      />
    )

    expect(mockResearchProcessSection).toHaveBeenCalled()
    const receivedParts = (
      mockResearchProcessSection.mock.calls[0][0] as { parts: unknown[] }
    ).parts
    expect(receivedParts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'tool-search' })])
    )

    expect(screen.queryByText(/output could not be rendered/i)).toBeNull()
  })
})
