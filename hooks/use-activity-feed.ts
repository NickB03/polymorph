'use client'

import { useEffect, useRef } from 'react'

import type { ToolPart, UIMessage, UIMessageMetadata } from '@/lib/types/ai'
import type { ChatStatus } from '@/lib/utils'

import type { ActivityItem } from '@/components/activity/activity-context'
import { useActivity } from '@/components/activity/activity-context'
import { useCanvas } from '@/components/canvas/canvas-context'
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

function getActivityItemId(
  type: 'search' | 'fetch' | 'link-preview' | 'citation',
  rawId: string
) {
  return `${type}:${rawId}`
}

function shouldUpdateItem(
  item: ActivityItem | undefined,
  nextState: ActivityItem['state']
) {
  return !item || item.state !== nextState
}

export function useActivityFeed(
  messages: UIMessage[],
  status: ChatStatus | undefined,
  chatId: string | undefined
): { isResearchMode: boolean } {
  const { state, addItem, updateItem, setResearchMode, reset, open } =
    useActivity()
  const canvas = useCanvas()
  const seenIds = useRef<Set<string>>(new Set())
  const hasAutoOpened = useRef(false)
  const pendingAutoOpen = useRef(false)
  const prevChatId = useRef<string | undefined>(undefined)
  const activityItemsRef = useRef<ActivityItem[]>(state.items)
  // chatId at the end of the most recent activity scan. Separate from
  // prevChatId (owned by the reset effect below) so the scan effect can
  // detect a chat change from inside its own body — reads are allowed in
  // effects, but the previous render-time compare flagged react-hooks/refs.
  const scanChatIdRef = useRef<string | undefined>(undefined)

  // Reset on chatId change
  useEffect(() => {
    if (chatId !== prevChatId.current) {
      prevChatId.current = chatId
      seenIds.current.clear()
      hasAutoOpened.current = false
      pendingAutoOpen.current = false
      reset()
    }
  }, [chatId, reset])

  useEffect(() => {
    activityItemsRef.current = state.items
  }, [state.items])

  useEffect(() => {
    if (
      !canvas.isWorkspaceOpen &&
      pendingAutoOpen.current &&
      !hasAutoOpened.current
    ) {
      pendingAutoOpen.current = false
      hasAutoOpened.current = true
      open()
    }
  }, [canvas.isWorkspaceOpen, open])

  // Scan latest assistant message
  useEffect(() => {
    const didChatChange = scanChatIdRef.current !== chatId
    scanChatIdRef.current = chatId

    const lastAssistant = messages.findLast(m => m.role === 'assistant')
    if (!lastAssistant) return

    // Detect research mode from metadata or todoWrite parts
    const metadata = lastAssistant.metadata as UIMessageMetadata | undefined
    const hasTodoWrite = lastAssistant.parts?.some(
      p => p.type === 'tool-todoWrite'
    )
    const isResearch = metadata?.userMode === 'research' || !!hasTodoWrite

    const label = isResearch ? 'Report' : 'Quick Search'
    if (isResearch !== state.isResearchMode) {
      setResearchMode(isResearch, label)
    }

    if (!lastAssistant.parts) return

    let addedNew = false
    const knownIds = new Set(seenIds.current)
    if (!didChatChange) {
      for (const item of activityItemsRef.current) {
        knownIds.add(item.id)
      }
    }
    const existingItems = new Map(
      activityItemsRef.current.map(item => [item.id, item])
    )

    for (const part of lastAssistant.parts) {
      if (part.type === 'tool-search') {
        const toolPart = part as ToolPart<'search'>
        const id = getActivityItemId('search', toolPart.toolCallId)
        const itemState = getToolPartState(toolPart)

        if (knownIds.has(id)) {
          seenIds.current.add(id)
          if (shouldUpdateItem(existingItems.get(id), itemState)) {
            updateItem(id, { state: itemState, data: toolPart })
          }
        } else {
          seenIds.current.add(id)
          knownIds.add(id)
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
        const id = getActivityItemId('fetch', toolPart.toolCallId)
        const itemState = getToolPartState(toolPart)

        if (knownIds.has(id)) {
          seenIds.current.add(id)
          if (shouldUpdateItem(existingItems.get(id), itemState)) {
            updateItem(id, { state: itemState, data: toolPart })
          }
        } else {
          seenIds.current.add(id)
          knownIds.add(id)
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
        if (parsed) {
          const id = getActivityItemId('link-preview', parsed.id)
          if (knownIds.has(id)) {
            seenIds.current.add(id)
            if (shouldUpdateItem(existingItems.get(id), 'complete')) {
              updateItem(id, { state: 'complete', data: parsed })
            }
          } else {
            seenIds.current.add(id)
            knownIds.add(id)
            addItem({
              id,
              type: 'link-preview',
              data: parsed,
              state: 'complete'
            })
            addedNew = true
          }
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
            if (parsed) {
              const id = getActivityItemId('citation', parsed.id)
              if (knownIds.has(id)) {
                seenIds.current.add(id)
                if (shouldUpdateItem(existingItems.get(id), 'complete')) {
                  updateItem(id, { state: 'complete', data: parsed })
                }
              } else {
                seenIds.current.add(id)
                knownIds.add(id)
                addItem({
                  id,
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
    }

    // Auto-open panel on first activity in research mode
    if (addedNew && isResearch && !hasAutoOpened.current) {
      if (canvas.isWorkspaceOpen) {
        pendingAutoOpen.current = true
      } else {
        hasAutoOpened.current = true
        open()
      }
    }
  }, [
    messages,
    status,
    state.isResearchMode,
    addItem,
    updateItem,
    setResearchMode,
    canvas.isWorkspaceOpen,
    open,
    chatId
  ])

  return { isResearchMode: state.isResearchMode }
}
