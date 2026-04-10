'use client'

import { useMemo, useRef, useState } from 'react'

import { UseChatHelpers } from '@ai-sdk/react'

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
import { useSidebar } from './ui/sidebar'
import { Skeleton } from './ui/skeleton'
import { ChatError } from './chat-error'
import { GuestSignupNudge } from './guest-signup-nudge'
import { RenderMessage } from './render-message'

const toolTypes = ['tool-search', 'tool-fetch', 'tool-relatedQuestions']

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
  /** Callback when a canvas artifact card is clicked */
  onCanvasArtifactClick?: (artifactId: string) => void
  /** Callback when a legacy artifact part is encountered */
  onLegacyArtifactClick?: (artifactId: string) => void
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
  error,
  onCanvasArtifactClick,
  onLegacyArtifactClick
}: ChatMessagesProps) {
  // Track user-modified states (when user explicitly opens/closes)
  const [userModifiedStates, setUserModifiedStates] = useState<
    Record<string, boolean>
  >({})
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
  }
  const isLoading = isChatLoading(status)

  const { open: sidebarOpen } = useSidebar()

  // Flatten sections into messages for the activity feed hook
  const allMessages = useMemo(
    () => sections.flatMap(s => [s.userMessage, ...s.assistantMessages]),
    [sections]
  )
  const { isResearchMode } = useActivityFeed(allMessages, status, chatId)

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

  const getIsOpen = (id: string, partType?: string, hasNextPart?: boolean) => {
    // If user has explicitly modified this state, use that
    if (Object.hasOwn(userModifiedStates, id)) {
      return userModifiedStates[id]
    }

    // For tool types, default to collapsed
    if (partType && toolTypes.includes(partType)) {
      return false
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
        sections.length > 0 ? 'flex flex-col flex-1 overflow-y-auto' : ''
      )}
    >
      {sections.length > 0 && <div className="flex-1" />}
      <div
        className={cn(
          'relative mx-auto w-full max-w-full md:max-w-4xl px-4 pb-6',
          !sidebarOpen && 'md:pl-12'
        )}
      >
        {sections.map((section, sectionIndex) => (
          <div
            key={section.id}
            id={`section-${section.id}`}
            className={cn(
              'chat-section',
              sectionIndex < sections.length - 1 && 'pb-14'
            )}
          >
            {/* User message */}
            <div className="flex flex-col gap-4 mb-4 animate-content-enter">
              <RenderMessage
                message={section.userMessage}
                messageId={section.userMessage.id}
                getIsOpen={getIsOpen}
                onOpenChange={handleOpenChange}
                onQuerySelect={onQuerySelect}
                chatId={chatId}
                status={status}
                addToolResult={addToolResult}
                onUpdateMessage={onUpdateMessage}
                reload={reload}
                citationMaps={allCitationMaps}
                isResearchMode={false}
                onCanvasArtifactClick={onCanvasArtifactClick}
                onLegacyArtifactClick={onLegacyArtifactClick}
              />
            </div>

            {/* Assistant messages */}
            {section.assistantMessages.map((assistantMessage, messageIndex) => {
              // Check if this is the latest assistant message in the latest section
              const isLatestMessage =
                sectionIndex === sections.length - 1 &&
                messageIndex === section.assistantMessages.length - 1

              return (
                <div
                  key={assistantMessage.id}
                  className="flex flex-col gap-2 animate-content-enter"
                  style={
                    {
                      '--enter-delay': `${100 + messageIndex * 75}ms`
                    } as React.CSSProperties
                  }
                >
                  <RenderMessage
                    message={assistantMessage}
                    messageId={assistantMessage.id}
                    getIsOpen={getIsOpen}
                    onOpenChange={handleOpenChange}
                    onQuerySelect={onQuerySelect}
                    chatId={chatId}
                    status={status}
                    addToolResult={addToolResult}
                    onUpdateMessage={onUpdateMessage}
                    reload={reload}
                    isLatestMessage={isLatestMessage}
                    citationMaps={allCitationMaps}
                    isResearchMode={isLatestMessage && isResearchMode}
                    onCanvasArtifactClick={onCanvasArtifactClick}
                    onLegacyArtifactClick={onLegacyArtifactClick}
                  />
                </div>
              )
            })}
            {/* Show loading after assistant messages */}
            {isLoading &&
              sectionIndex === sections.length - 1 &&
              (section.assistantMessages.length === 0 ||
              !section.assistantMessages.some(m => m.parts?.length) ? (
                <div className="flex flex-col gap-3 py-2">
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
                <div className="flex justify-start py-2">
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
