import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import { RenderMessage } from './render-message'

const { mockResearchProcessSection } = vi.hoisted(() => ({
  mockResearchProcessSection: vi.fn((_props: Record<string, unknown>) => null)
}))

vi.mock('./answer-section', () => ({
  AnswerSection: ({ content }: { content: string }) => (
    <div data-testid="answer-section">{content}</div>
  )
}))

vi.mock('./dynamic-tool-display', () => ({
  DynamicToolDisplay: ({
    part
  }: {
    part: { toolName: string; state: string; output?: unknown }
  }) => {
    if (part.state === 'output-available') {
      const rendered =
        part.toolName === 'createCanvasArtifact' ||
        part.toolName === 'readCanvasArtifact' ? (
          <div data-testid="canvas-artifact-card" data-source="tool" />
        ) : null
      return rendered
    }
    return null
  }
}))

vi.mock('./message-actions', () => ({
  MessageActions: () => null
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

vi.mock('./tool-ui/registry', () => ({
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
        <div data-testid="competitor-research-tool-ui" data-part-id={partId} />
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

    return null
  }
}))

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

  it('renders a single artifact card when dynamic tool output and persisted artifact data both exist', () => {
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

    expect(screen.getAllByTestId('canvas-artifact-card')).toHaveLength(1)
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

  it('renders a clickable artifact card from dynamic-tool when no data-canvasArtifact part exists', () => {
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

  it('suppresses dynamic-tool canvas cards with empty artifactId', () => {
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

    expect(screen.queryByTestId('canvas-artifact-card')).not.toBeInTheDocument()
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
})
