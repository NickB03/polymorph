'use client'

import { UseChatHelpers } from '@ai-sdk/react'

import type { ToolPart, UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'

import FetchSection from './fetch-section'
import { QuestionConfirmation } from './question-confirmation'
import { SearchSection } from './search-section'

interface ToolSectionProps {
  tool: ToolPart
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  status?: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  onQuerySelect: (query: string) => void
  borderless?: boolean
  isFirst?: boolean
  isLast?: boolean
}

/**
 * Render the UI section appropriate for the provided tool invocation.
 *
 * Renders a specialized confirmation view for `tool-askQuestion` states that require user input or display results, otherwise dispatches to the corresponding section component for `tool-search` and `tool-fetch`.
 *
 * @param tool - The tool invocation and its current state used to determine which section to render
 * @param isOpen - Whether the section panel is open
 * @param onOpenChange - Callback invoked when the section open state changes
 * @param status - Optional status passed to child sections
 * @param addToolResult - Callback to persist a tool result when the user confirms or declines an ask-question prompt
 * @param onQuerySelect - Callback invoked when a query is selected inside a child section
 * @param borderless - Render the section without borders (default: false)
 * @param isFirst - Marks the section as the first in a list (default: false)
 * @param isLast - Marks the section as the last in a list (default: false)
 * @returns The React element for the tool's UI section, or `null` if the tool type is unsupported
 */
export function ToolSection({
  tool,
  isOpen,
  onOpenChange,
  status,
  addToolResult,
  onQuerySelect,
  borderless = false,
  isFirst = false,
  isLast = false
}: ToolSectionProps) {
  // Special handling for ask_question tool
  if (tool.type === 'tool-askQuestion') {
    // When waiting for user input
    if (
      (tool.state === 'input-streaming' || tool.state === 'input-available') &&
      addToolResult
    ) {
      return (
        <QuestionConfirmation
          toolInvocation={tool as ToolPart<'askQuestion'>}
          onConfirm={(toolCallId, approved, response) => {
            addToolResult({
              toolCallId,
              result: approved
                ? response
                : {
                    declined: true,
                    skipped: response?.skipped,
                    message: 'User declined this question'
                  }
            })
          }}
        />
      )
    }

    // When result is available, display the result
    if (tool.state === 'output-available') {
      return (
        <QuestionConfirmation
          toolInvocation={tool as ToolPart<'askQuestion'>}
          isCompleted={true}
          onConfirm={() => {}} // Not used in result display mode
        />
      )
    }
  }

  switch (tool.type) {
    case 'tool-search':
      return (
        <SearchSection
          tool={tool as ToolPart<'search'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
          borderless={borderless}
          isFirst={isFirst}
          isLast={isLast}
        />
      )
    case 'tool-fetch':
      return (
        <FetchSection
          tool={tool as ToolPart<'fetch'>}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          status={status}
          borderless={borderless}
          isFirst={isFirst}
          isLast={isLast}
        />
      )
    default:
      return null
  }
}
