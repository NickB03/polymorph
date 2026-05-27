import React from 'react'

import type { ReasoningPart } from '@ai-sdk/provider-utils'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, Mock, test, vi } from 'vitest'

import type { ToolPart, UIMessage } from '@/lib/types/ai'

import { ResearchProcessSection } from '../research-process-section'

const mockRelatedQuestions = vi.hoisted(() => vi.fn())
const mockReasoningSection = vi.hoisted(() => vi.fn())

// Mock the child components
vi.mock('../reasoning-section', () => ({
  ReasoningSection: ({
    content,
    isOpen,
    onOpenChange,
    collapsibleContentId
  }: any) => {
    mockReasoningSection({ content, isOpen })
    return (
      <div
        data-collapsible-content-id={collapsibleContentId}
        data-testid="reasoning-section"
      >
        <button onClick={() => onOpenChange(!isOpen)}>
          {isOpen ? 'Close' : 'Open'} Reasoning
        </button>
        {isOpen && <div>{content.reasoning}</div>}
      </div>
    )
  }
}))

vi.mock('../tool-section', () => ({
  ToolSection: ({ tool, isOpen, onOpenChange }: any) => (
    <div data-testid="tool-section">
      <button onClick={() => onOpenChange(!isOpen)}>
        {isOpen ? 'Close' : 'Open'} Tool
      </button>
      {isOpen && <div>{tool.type}</div>}
    </div>
  )
}))

vi.mock('../related-questions', () => ({
  RelatedQuestions: (props: any) => {
    mockRelatedQuestions(props)
    return <div data-testid="related-questions" />
  }
}))

describe('ResearchProcessSection', () => {
  const mockGetIsOpen = vi.fn()
  const mockOnOpenChange = vi.fn()
  const mockOnQuerySelect = vi.fn()
  const mockSubmitInteractiveToolOutput = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetIsOpen.mockReturnValue(false)
  })

  describe('Type Guards', () => {
    test('correctly identifies reasoning parts', () => {
      const reasoningPart: ReasoningPart = {
        type: 'reasoning',
        text: 'Test reasoning'
      }

      const message = {
        id: 'test-message',
        role: 'assistant' as const,
        parts: [reasoningPart]
      } as unknown as UIMessage

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-1"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      expect(screen.getByTestId('reasoning-section')).toBeInTheDocument()
    })

    test('correctly identifies tool parts', () => {
      const toolPart: ToolPart = {
        type: 'tool-search',
        toolCallId: 'tool-1',
        input: {},
        state: 'output-available'
      }

      const message = {
        id: 'test-message',
        role: 'assistant' as const,
        parts: [toolPart as any]
      } as UIMessage

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-2"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      expect(screen.getByTestId('tool-section')).toBeInTheDocument()
    })

    test('filters out empty reasoning parts', () => {
      const emptyReasoningPart: ReasoningPart = {
        type: 'reasoning',
        text: ''
      }

      const validReasoningPart: ReasoningPart = {
        type: 'reasoning',
        text: 'Valid reasoning'
      }

      const message = {
        id: 'test-message',
        role: 'assistant' as const,
        parts: [emptyReasoningPart, validReasoningPart]
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-3"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      // Should only render one reasoning section (the valid one)
      const reasoningSections = screen.getAllByTestId('reasoning-section')
      expect(reasoningSections).toHaveLength(1)
    })
  })

  describe('Segmentation Logic', () => {
    test('splits parts by text correctly', () => {
      const parts: any[] = [
        { type: 'reasoning', text: 'First reasoning' } as ReasoningPart,
        {
          type: 'tool-search',
          toolCallId: 'tool-1',
          input: {},
          state: 'output-available'
        } as ToolPart,
        { type: 'text', text: 'Text separator' },
        { type: 'reasoning', text: 'Second reasoning' } as ReasoningPart
      ]

      const message: UIMessage = {
        id: 'test-message',
        role: 'assistant',
        parts
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-4"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      // Should render 3 sections (2 reasoning + 1 tool, split by text)
      const allSections = [
        ...screen.getAllByTestId('reasoning-section'),
        ...screen.getAllByTestId('tool-section')
      ]
      expect(allSections).toHaveLength(3)
    })

    test('groups consecutive tool parts of same type', () => {
      const parts: any[] = [
        {
          type: 'tool-search',
          toolCallId: 'tool-1',
          input: {},
          state: 'output-available'
        } as ToolPart,
        {
          type: 'tool-search',
          toolCallId: 'tool-2',
          input: {},
          state: 'output-available'
        } as ToolPart,
        {
          type: 'tool-fetch',
          toolCallId: 'tool-3',
          input: {},
          state: 'output-available'
        } as ToolPart
      ]

      const message: UIMessage = {
        id: 'test-message',
        role: 'assistant',
        parts
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-5"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      const toolSections = screen.getAllByTestId('tool-section')
      expect(toolSections).toHaveLength(3)
    })

    test('coalesces reasoning parts within a segment into one disclosure', () => {
      // ToolLoopAgent emits one reasoning part per step (reason → tool →
      // reason → text). Render must collapse them into a single "Thoughts"
      // disclosure, not one disclosure per step.
      mockReasoningSection.mockClear()
      const parts: any[] = [
        { type: 'reasoning', text: 'First thought' } as ReasoningPart,
        {
          type: 'tool-canvas',
          toolCallId: 'tool-1',
          input: {},
          state: 'output-available'
        } as ToolPart,
        { type: 'reasoning', text: 'Second thought' } as ReasoningPart
      ]

      const message: UIMessage = {
        id: 'test-coalesce',
        role: 'assistant',
        parts
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-coalesce"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      // Exactly one reasoning section, not two
      expect(screen.getAllByTestId('reasoning-section')).toHaveLength(1)
      // Tool section preserved
      expect(screen.getAllByTestId('tool-section')).toHaveLength(1)
      // Merged content joins both reasoning texts
      const reasoningCalls = mockReasoningSection.mock.calls
      const merged = reasoningCalls[reasoningCalls.length - 1][0].content
        .reasoning as string
      expect(merged).toBe('First thought\n\nSecond thought')
    })

    test('leaves single reasoning parts untouched', () => {
      mockReasoningSection.mockClear()
      const parts: any[] = [
        { type: 'reasoning', text: 'Only thought' } as ReasoningPart
      ]

      const message: UIMessage = {
        id: 'test-no-coalesce',
        role: 'assistant',
        parts
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-no-coalesce"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      expect(screen.getAllByTestId('reasoning-section')).toHaveLength(1)
      const reasoningCalls = mockReasoningSection.mock.calls
      expect(
        reasoningCalls[reasoningCalls.length - 1][0].content.reasoning
      ).toBe('Only thought')
    })
  })

  describe('Accordion Behavior', () => {
    test('handles accordion state for grouped sections', () => {
      const parts: any[] = [
        { type: 'reasoning', text: 'First' } as ReasoningPart,
        { type: 'reasoning', text: 'Second' } as ReasoningPart
      ]

      const message: UIMessage = {
        id: 'test-message',
        role: 'assistant',
        parts
      }

      const { rerender } = render(
        <ResearchProcessSection
          message={message}
          messageId="test-6"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      const buttons = screen.getAllByRole('button')

      // Click first button to open
      fireEvent.click(buttons[0])

      // Should call onOpenChange
      expect(mockOnOpenChange).toHaveBeenCalled()

      // Update mock to return true for the clicked item
      mockGetIsOpen.mockImplementation(id => id.includes('reasoning-0-0-0'))

      rerender(
        <ResearchProcessSection
          message={message}
          messageId="test-6"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )
    })

    test('handles single sections differently from grouped sections', () => {
      const singlePart = [
        { type: 'reasoning', text: 'Single reasoning' } as ReasoningPart
      ]

      const message = {
        id: 'test-message',
        role: 'assistant' as const,
        parts: singlePart
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-7"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      // For single sections, should directly call onOpenChange
      expect(mockOnOpenChange).toHaveBeenCalledWith(
        expect.stringContaining('reasoning'),
        true
      )
    })
  })

  describe('Subsequent Content Detection', () => {
    test('detects subsequent content correctly', () => {
      const parts: any[] = [
        { type: 'reasoning', text: 'First' } as ReasoningPart,
        { type: 'text', text: 'Text' },
        { type: 'reasoning', text: 'Second' } as ReasoningPart
      ]

      const message: UIMessage = {
        id: 'test-message',
        role: 'assistant',
        parts
      }

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-8"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      // The first reasoning should detect subsequent content (the text part)
      expect(mockGetIsOpen).toHaveBeenCalledWith(
        expect.stringContaining('reasoning'),
        'reasoning',
        true // hasSubsequentContent should be true
      )
    })
  })

  describe('Edge Cases', () => {
    test('returns null for empty segments', () => {
      const message = {
        id: 'test-message',
        role: 'assistant' as const,
        parts: []
      }

      const { container } = render(
        <ResearchProcessSection
          message={message}
          messageId="test-9"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    test('handles parts override correctly', () => {
      const message = {
        id: 'test-message',
        role: 'assistant' as const,
        parts: [{ type: 'reasoning', text: 'Original' } as ReasoningPart]
      }

      const overrideParts = [
        { type: 'reasoning', text: 'Override' } as ReasoningPart
      ]

      // Mock getIsOpen to return true so content is visible
      mockGetIsOpen.mockReturnValue(true)

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-10"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
          parts={overrideParts}
        />
      )

      // Should use override parts
      expect(screen.getByTestId('reasoning-section')).toBeInTheDocument()
      // The content should show "Override" when open
      expect(screen.getByText('Override')).toBeInTheDocument()
    })

    test('handles data parts correctly', () => {
      const parts: any[] = [{ type: 'data-test', data: 'test' }]

      const message: UIMessage = {
        id: 'test-message',
        role: 'assistant',
        parts
      }

      const { container } = render(
        <ResearchProcessSection
          message={message}
          messageId="test-11"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
        />
      )

      // Data parts should render the DataSection component
      // Check that the component renders (not null)
      expect(container.firstChild).toBeInTheDocument()
    })

    test('uses process section ids to keep parts override controls unique', () => {
      // Use distinct tool types so groupConsecutiveParts keeps them as
      // separate single-item groups, preserving the 5-step total that
      // triggers the parent collapsible. (Reasoning parts would coalesce
      // into one merged part and totalParts would drop below the threshold.)
      const TOOL_TYPES = [
        'tool-search',
        'tool-fetch',
        'tool-image',
        'tool-canvas',
        'tool-code'
      ] as const

      const buildParts = (prefix: string) =>
        TOOL_TYPES.map((type, index) => ({
          type,
          toolCallId: `${prefix}-tool-${index}`,
          input: {},
          state: 'output-available'
        })) as unknown as ToolPart[]

      const message = {
        id: 'assistant-1',
        role: 'assistant' as const,
        parts: []
      } as UIMessage

      render(
        <>
          <ResearchProcessSection
            message={message}
            messageId={message.id}
            processSectionId={`${message.id}-proc-seg-0`}
            getIsOpen={mockGetIsOpen}
            onOpenChange={mockOnOpenChange}
            onQuerySelect={mockOnQuerySelect}
            parts={buildParts('first') as any}
          />
          <ResearchProcessSection
            message={message}
            messageId={message.id}
            processSectionId={`${message.id}-proc-seg-2`}
            getIsOpen={mockGetIsOpen}
            onOpenChange={mockOnOpenChange}
            onQuerySelect={mockOnQuerySelect}
            parts={buildParts('second') as any}
          />
        </>
      )

      const parentButtons = screen.getAllByRole('button', {
        name: /Research Process \(5 steps\)/i
      })
      const parentControlIds = parentButtons.map(button =>
        button.getAttribute('aria-controls')
      )

      expect(parentControlIds).toEqual([
        'assistant-1-proc-seg-0-parent-0-content',
        'assistant-1-proc-seg-2-parent-0-content'
      ])
      expect(new Set(parentControlIds).size).toBe(parentControlIds.length)

      parentButtons.forEach(button => fireEvent.click(button))

      const toolControlIds = screen.getAllByTestId('tool-section')
      // Two ResearchProcessSection instances × 5 tools each = 10 tool sections
      expect(toolControlIds).toHaveLength(10)
    })
  })

  describe('Props Handling', () => {
    test('passes status prop correctly', () => {
      const toolPart: ToolPart = {
        type: 'tool-search',
        toolCallId: 'tool-1',
        input: {},
        state: 'output-available'
      }

      const message = {
        id: 'test-message',
        role: 'assistant' as const,
        parts: [toolPart as any]
      } as UIMessage

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-12"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
          status="streaming"
        />
      )

      expect(screen.getByTestId('tool-section')).toBeInTheDocument()
    })

    test('forwards isLatestMessage to related questions data parts', () => {
      const message = {
        id: 'test-message',
        role: 'assistant' as const,
        parts: [
          {
            type: 'data-relatedQuestions',
            data: {
              status: 'success',
              questions: [{ question: 'What next?' }]
            }
          } as any
        ]
      } as UIMessage

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-14"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
          isLatestMessage
        />
      )

      expect(mockRelatedQuestions).toHaveBeenCalled()
      expect(mockRelatedQuestions.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          isLatestMessage: true,
          onQuerySelect: mockOnQuerySelect
        })
      )
    })

    test('passes submitInteractiveToolOutput prop correctly', () => {
      const toolPart: ToolPart = {
        type: 'tool-search',
        toolCallId: 'tool-1',
        input: {},
        state: 'output-available'
      }

      const message = {
        id: 'test-message',
        role: 'assistant' as const,
        parts: [toolPart as any]
      } as UIMessage

      render(
        <ResearchProcessSection
          message={message}
          messageId="test-13"
          getIsOpen={mockGetIsOpen}
          onOpenChange={mockOnOpenChange}
          onQuerySelect={mockOnQuerySelect}
          submitInteractiveToolOutput={mockSubmitInteractiveToolOutput}
        />
      )

      expect(screen.getByTestId('tool-section')).toBeInTheDocument()
    })
  })
})
