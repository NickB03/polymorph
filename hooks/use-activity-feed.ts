'use client'

import { useEffect, useRef } from 'react'

import type { ToolPart, UIMessage, UIMessageMetadata } from '@/lib/types/ai'
import type { ChatStatus } from '@/lib/utils'

import { useActivity } from '@/components/activity/activity-context'
import { safeParseSerializableCitation } from '@/components/tool-ui/citation/schema'
import { safeParseSerializableLinkPreview } from '@/components/tool-ui/link-preview/schema'

function getToolPartState(part: ToolPart): 'active' | 'complete' | 'error' {
  switch (part.state) {
    case 'output-available':
      return 'complete'
    case 'output-error':
      return 'error'
    default:
      return 'active'
  }
}

export function useActivityFeed(
  messages: UIMessage[],
  status: ChatStatus | undefined,
  chatId: string | undefined
): { isResearchMode: boolean } {
  const { state, addItem, updateItem, setResearchMode, reset, open } =
    useActivity()
  const seenIds = useRef<Set<string>>(new Set())
  const hasAutoOpened = useRef(false)
  const prevChatId = useRef<string | undefined>(chatId)

  // Reset on chatId change
  useEffect(() => {
    if (chatId !== prevChatId.current) {
      prevChatId.current = chatId
      seenIds.current.clear()
      hasAutoOpened.current = false
      reset()
    }
  }, [chatId, reset])

  // Scan latest assistant message
  useEffect(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find(m => m.role === 'assistant')
    if (!lastAssistant) return

    // Detect research mode from metadata or todoWrite parts
    const metadata = lastAssistant.metadata as UIMessageMetadata | undefined
    const hasTodoWrite = lastAssistant.parts?.some(
      p => p.type === 'tool-todoWrite'
    )
    const isResearch = metadata?.searchMode === 'research' || !!hasTodoWrite

    const label = isResearch ? 'Report' : 'Quick Search'
    if (isResearch !== state.isResearchMode) {
      setResearchMode(isResearch, label)
    }

    if (!lastAssistant.parts) return

    let addedNew = false

    for (const part of lastAssistant.parts) {
      if (part.type === 'tool-search') {
        const toolPart = part as ToolPart<'search'>
        const id = toolPart.toolCallId
        const itemState = getToolPartState(toolPart)

        if (seenIds.current.has(id)) {
          updateItem(id, { state: itemState, data: toolPart })
        } else {
          seenIds.current.add(id)
          addItem({
            id,
            type: 'search',
            data: toolPart,
            state: itemState
          })
          addedNew = true
        }
      } else if (part.type === 'tool-fetch') {
        const toolPart = part as ToolPart<'fetch'>
        const id = toolPart.toolCallId
        const itemState = getToolPartState(toolPart)

        if (seenIds.current.has(id)) {
          updateItem(id, { state: itemState, data: toolPart })
        } else {
          seenIds.current.add(id)
          addItem({
            id,
            type: 'fetch',
            data: toolPart,
            state: itemState
          })
          addedNew = true
        }
      } else if (
        part.type === 'tool-displayLinkPreview' &&
        (part as ToolPart).state === 'output-available'
      ) {
        const toolPart = part as ToolPart
        const parsed = safeParseSerializableLinkPreview(toolPart.output)
        if (parsed && !seenIds.current.has(parsed.id)) {
          seenIds.current.add(parsed.id)
          addItem({
            id: parsed.id,
            type: 'link-preview',
            data: parsed,
            state: 'complete'
          })
          addedNew = true
        }
      } else if (
        part.type === 'tool-displayCitations' &&
        (part as ToolPart).state === 'output-available'
      ) {
        const toolPart = part as ToolPart
        const output = toolPart.output as { citations?: unknown[] } | undefined
        if (output?.citations && Array.isArray(output.citations)) {
          for (const raw of output.citations) {
            const parsed = safeParseSerializableCitation(raw)
            if (parsed && !seenIds.current.has(parsed.id)) {
              seenIds.current.add(parsed.id)
              addItem({
                id: parsed.id,
                type: 'citation',
                data: parsed,
                state: 'complete'
              })
              addedNew = true
            }
          }
        }
      }
    }

    // Auto-open panel on first activity in research mode
    if (addedNew && isResearch && !hasAutoOpened.current) {
      hasAutoOpened.current = true
      open()
    }
  }, [
    messages,
    status,
    state.isResearchMode,
    addItem,
    updateItem,
    setResearchMode,
    open
  ])

  return { isResearchMode: state.isResearchMode }
}
