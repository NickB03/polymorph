import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import { RenderMessage } from './render-message'

vi.mock('./answer-section', () => ({
  AnswerSection: ({ content }: { content: string }) => <div>{content}</div>
}))

vi.mock('./dynamic-tool-display', () => ({
  DynamicToolDisplay: () => null
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
  CanvasArtifactCard: () => null
}))

vi.mock('./tool-ui/option-list/option-list', () => ({
  OptionList: () => null
}))

vi.mock('./tool-ui/option-list/schema', () => ({
  safeParseSerializableOptionList: () => null
}))

vi.mock('./tool-ui/registry', () => ({
  tryRenderToolUI: () => null,
  tryRenderToolUIByName: () => null
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
})
