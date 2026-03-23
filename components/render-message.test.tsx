import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import { RenderMessage } from './render-message'

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
        part.toolName === 'createCanvasArtifact' ? (
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
  default: () => null
}))

vi.mock('./research-status-line', () => ({
  ResearchStatusLine: () => null
}))

vi.mock('./tool-ui/canvas-artifact-card', () => ({
  CanvasArtifactCard: () => <div data-testid="canvas-artifact-card" />
}))

vi.mock('./tool-ui/option-list/option-list', () => ({
  OptionList: () => null
}))

vi.mock('./tool-ui/option-list/schema', () => ({
  safeParseSerializableOptionList: () => null
}))

vi.mock('./tool-ui/registry', () => ({
  tryRenderToolUI: () => null,
  tryRenderToolUIByName: (toolName: string, output: unknown) => {
    if (
      (toolName === 'createCanvasArtifact' ||
        toolName === 'updateCanvasArtifact') &&
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
})
