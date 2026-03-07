'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { UseChatHelpers } from '@ai-sdk/react'

import { useMediaQuery } from '@/lib/hooks/use-media-query'
import type {
  ChatSection,
  UIDataTypes,
  UIMessage,
  UITools
} from '@/lib/types/ai'
import { cn, isChatLoading } from '@/lib/utils'
import { extractCitationMapsFromMessages } from '@/lib/utils/citation'

import { useActivityFeed } from '@/hooks/use-activity-feed'

import { AnimatedLogo } from './ui/animated-logo'
import { Skeleton } from './ui/skeleton'
import { ChatError } from './chat-error'
import { GuestSignupNudge } from './guest-signup-nudge'
import { RenderMessage } from './render-message'

interface ChatMessagesProps {
  sections: ChatSection[] // Changed from messages to sections
  onQuerySelect: (query: string) => void
  status: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  chatId?: string
  isGuest?: boolean
  addToolResult?: (params: { toolCallId: string; result: any }) => void
  /** Ref for the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  onUpdateMessage?: (messageId: string, newContent: string) => Promise<void>
  reload?: (messageId: string) => Promise<void | string | null | undefined>
  error?: Error | string | null | undefined
}

export function ChatMessages({
  sections,
  onQuerySelect,
  status,
  chatId,
  isGuest = false,
  addToolResult,
  scrollContainerRef,
  onUpdateMessage,
  reload,
  error
}: ChatMessagesProps) {
  // Track user-modified states (when user explicitly opens/closes)
  const [userModifiedStates, setUserModifiedStates] = useState<
    Record<string, boolean>
  >({})
  // Cache tool counts for performance optimization
  const toolCountCacheRef = useRef<Map<string, number>>(new Map())
  // Cache citation maps per message to avoid recomputing from all messages during streaming
  const citationCacheRef = useRef<
    Record<
      string,
      Record<string, Record<number, import('@/lib/types').SearchResultItem>>
    >
  >({})
  const prevChatIdRef = useRef(chatId)
  if (prevChatIdRef.current !== chatId) {
    prevChatIdRef.current = chatId
    citationCacheRef.current = {}
    toolCountCacheRef.current.clear()
  }
  const isLoading = isChatLoading(status)
  const isMobile = useMediaQuery('(max-width: 767px)')

  // Flatten sections into messages for the activity feed hook
  const allMessages = useMemo(
    () => sections.flatMap(s => [s.userMessage, ...s.assistantMessages]),
    [sections]
  )
  const { isResearchMode } = useActivityFeed(allMessages, status, chatId)

  // Tool types definition - moved outside function for performance
  const toolTypes = ['tool-search', 'tool-fetch', 'tool-relatedQuestions']

  // Clear cache during streaming to ensure accurate tool counts
  useEffect(() => {
    if (!isLoading) return
    // Only clear cache for the last section's messages (currently streaming)
    const lastSection = sections[sections.length - 1]
    if (!lastSection) return
    const streamingIds = new Set(
      [lastSection.userMessage, ...lastSection.assistantMessages].map(m => m.id)
    )
    for (const key of toolCountCacheRef.current.keys()) {
      if (streamingIds.has(key)) {
        toolCountCacheRef.current.delete(key)
      }
    }
  }, [isLoading, sections])

  // Calculate the offset height based on device type
  // Note: pt-14 (56px) on scroll-container must be included in desktop offset
  const offsetHeight = isMobile
    ? 208 // Mobile: larger offset for mobile header/input
    : 196 // Desktop: smaller offset (140px) + pt-14 (56px)

  // Extract citation maps from all messages in all sections
  const allCitationMaps = useMemo(() => {
    const result: Record<
      string,
      Record<number, import('@/lib/types').SearchResultItem>
    > = {}
    const cache = citationCacheRef.current
    sections.forEach((section, sIdx) => {
      const isLastSection = sIdx === sections.length - 1
      for (const msg of [section.userMessage, ...section.assistantMessages]) {
        // Only cache completed messages; recompute the latest section during streaming
        const canCache = !(isLoading && isLastSection)
        if (!canCache || !cache[msg.id]) {
          const maps = extractCitationMapsFromMessages([msg])
          if (canCache) {
            cache[msg.id] = maps
          }
          Object.assign(result, maps)
        } else {
          Object.assign(result, cache[msg.id])
        }
      }
    })
    return result
  }, [sections, isLoading])

  if (!sections.length) return null

  // Helper function to get tool count with caching
  const getToolCount = (message?: UIMessage): number => {
    if (!message || !message.id) return 0

    // During streaming, always recalculate
    if (isLoading) {
      const count =
        message.parts?.filter(part => toolTypes.includes(part.type)).length || 0
      return count
    }

    // Check cache first when not streaming
    const cached = toolCountCacheRef.current.get(message.id)
    if (cached !== undefined) {
      return cached
    }

    // Calculate and cache
    const count =
      message.parts?.filter(part => toolTypes.includes(part.type)).length || 0
    toolCountCacheRef.current.set(message.id, count)
    return count
  }

  const getIsOpen = (
    id: string,
    partType?: string,
    hasNextPart?: boolean,
    message?: UIMessage
  ) => {
    // If user has explicitly modified this state, use that
    if (userModifiedStates.hasOwnProperty(id)) {
      return userModifiedStates[id]
    }

    // For tool types, check if there are multiple tools
    if (partType && toolTypes.includes(partType)) {
      const toolCount = getToolCount(message)
      // If multiple tools exist, default to closed
      if (toolCount > 1) {
        return false
      }
      // Single tool results stay open even if more content follows
      return true
    }

    // For tool-invocations, default to open
    if (partType === 'tool-invocation') {
      return true
    }

    // For reasoning, auto-collapse if there's a next part in the same message
    if (partType === 'reasoning') {
      return !hasNextPart
    }

    // For other types (like text), default to open
    return true
  }

  const handleOpenChange = (id: string, open: boolean) => {
    setUserModifiedStates(prev => ({
      ...prev,
      [id]: open
    }))
  }

  return (
    <div
      id="scroll-container"
      ref={scrollContainerRef}
      role="list"
      aria-roledescription="chat messages"
      className={cn(
        'relative size-full pt-14',
        sections.length > 0 ? 'flex-1 overflow-y-auto' : ''
      )}
    >
      <div className="relative mx-auto w-full max-w-full md:max-w-3xl px-4">
        {sections.map((section, sectionIndex) => (
          <div
            key={section.id}
            id={`section-${section.id}`}
            className="chat-section pb-14"
            style={
              sectionIndex === sections.length - 1
                ? { minHeight: `calc(100dvh - ${offsetHeight}px)` }
                : {}
            }
          >
            {/* User message */}
            <div className="flex flex-col gap-4 mb-4">
              <RenderMessage
                message={section.userMessage}
                messageId={section.userMessage.id}
                getIsOpen={(id, partType, hasNextPart) =>
                  getIsOpen(id, partType, hasNextPart, section.userMessage)
                }
                onOpenChange={handleOpenChange}
                onQuerySelect={onQuerySelect}
                chatId={chatId}
                isGuest={isGuest}
                status={status}
                addToolResult={addToolResult}
                onUpdateMessage={onUpdateMessage}
                reload={reload}
                citationMaps={allCitationMaps}
                isResearchMode={false}
              />
            </div>

            {/* Assistant messages */}
            {section.assistantMessages.map((assistantMessage, messageIndex) => {
              // Check if this is the latest assistant message in the latest section
              const isLatestMessage =
                sectionIndex === sections.length - 1 &&
                messageIndex === section.assistantMessages.length - 1

              return (
                <div key={assistantMessage.id} className="flex flex-col gap-4">
                  <RenderMessage
                    message={assistantMessage}
                    messageId={assistantMessage.id}
                    getIsOpen={(id, partType, hasNextPart) =>
                      getIsOpen(id, partType, hasNextPart, assistantMessage)
                    }
                    onOpenChange={handleOpenChange}
                    onQuerySelect={onQuerySelect}
                    chatId={chatId}
                    isGuest={isGuest}
                    status={status}
                    addToolResult={addToolResult}
                    onUpdateMessage={onUpdateMessage}
                    reload={reload}
                    isLatestMessage={isLatestMessage}
                    citationMaps={allCitationMaps}
                    isResearchMode={isLatestMessage && isResearchMode}
                  />
                </div>
              )
            })}
            {/* Show loading after assistant messages */}
            {isLoading &&
              sectionIndex === sections.length - 1 &&
              (section.assistantMessages.length === 0 ||
              !section.assistantMessages.some(m => m.parts?.length) ? (
                <div className="flex flex-col gap-3 py-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton
                    className="h-5 w-full"
                    style={{ animationDelay: '75ms' }}
                  />
                  <Skeleton
                    className="h-5 w-5/6"
                    style={{ animationDelay: '150ms' }}
                  />
                </div>
              ) : (
                <div className="flex justify-start py-4">
                  <AnimatedLogo className="h-10 w-10" />
                </div>
              ))}
            {isGuest &&
              !isLoading &&
              sectionIndex === sections.length - 1 &&
              section.assistantMessages.length > 0 && <GuestSignupNudge />}
            {sectionIndex === sections.length - 1 && (
              <ChatError error={error} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
