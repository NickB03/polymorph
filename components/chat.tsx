'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { toast } from 'sonner'

import { generateId } from '@/lib/db/schema'
import { UploadedFile } from '@/lib/types'
import type { ChatSection, UIMessage, UIMessageMetadata } from '@/lib/types/ai'
import {
  isDynamicToolPart,
  isInteractiveToolPart,
  isToolCallPart,
  isToolTypePart
} from '@/lib/types/dynamic-tools'
import { isValidModelType } from '@/lib/types/model-type'
import { isValidSearchMode } from '@/lib/types/search'
import { cn } from '@/lib/utils'
import { syncModelType } from '@/lib/utils/model-type'
import { syncSearchMode } from '@/lib/utils/search-mode'

import { useFileDropzone } from '@/hooks/use-file-dropzone'

import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'
import { DragOverlay } from './drag-overlay'
import { ErrorModal } from './error-modal'

const EMPTY_MESSAGES: UIMessage[] = []

export function Chat({
  id: providedId,
  savedMessages = EMPTY_MESSAGES,
  query,
  isGuest = false
}: {
  id?: string
  savedMessages?: UIMessage[]
  query?: string
  isGuest?: boolean
}) {
  const router = useRouter()

  // Generate a stable chatId on the client side
  // - If providedId exists (e.g., /search/[id]), use it for existing chats
  // - Otherwise, generate a new ID (e.g., / homepage for new chats)
  const [chatId, setChatId] = useState(() => providedId || generateId())

  // Callback to reset chat state when user clicks "New" button
  const handleNewChat = () => {
    stop() // Cancel any in-flight stream before switching chat
    const newId = generateId()
    setChatId(newId)
    // Clear other chat-related state that persists due to Next.js 16 component caching
    setInput('')
    setUploadedFiles([])
    autoSendFiredRef.current.clear()
    setErrorModal({
      open: false,
      type: 'general',
      message: ''
    })
    syncSearchMode('chat')
    syncModelType('speed')
  }

  // Restore search mode and model type from saved chat metadata, or reset for new conversations
  useEffect(() => {
    if (savedMessages.length > 0) {
      const lastAssistantMessage = savedMessages.findLast(
        m => m.role === 'assistant'
      )
      const metadata = lastAssistantMessage?.metadata as
        | UIMessageMetadata
        | undefined
      if (isValidSearchMode(metadata?.searchMode)) {
        syncSearchMode(metadata.searchMode)
      }
      if (isValidModelType(metadata?.modelType)) {
        syncModelType(metadata.modelType)
      }
    } else {
      syncSearchMode('chat')
      syncModelType('speed')
    }
  }, [providedId, savedMessages])

  const autoSendFiredRef = useRef<Set<string>>(new Set())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [input, setInput] = useState('')
  const [errorModal, setErrorModal] = useState<{
    open: boolean
    type: 'rate-limit' | 'auth' | 'forbidden' | 'general'
    message: string
    details?: string
  }>({
    open: false,
    type: 'general',
    message: ''
  })

  const {
    messages,
    status,
    setMessages,
    stop,
    sendMessage,
    regenerate,
    addToolResult,
    error
  } = useChat({
    id: chatId, // use the client-generated or provided chatId
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages, trigger, messageId }) => {
        // Simplify by passing AI SDK's default trigger values directly
        const lastMessage = messages[messages.length - 1]
        const messageToRegenerate =
          trigger === 'regenerate-message'
            ? messages.find(m => m.id === messageId)
            : undefined

        // Detect tool-result continuation: sendAutomaticallyWhen fires with
        // trigger="submit-message" but last message is assistant (not user)
        const isToolResultContinuation =
          trigger === 'submit-message' && lastMessage?.role === 'assistant'

        // For tool-result continuation, extract the minimal delta
        if (isToolResultContinuation) {
          const resolvedPart = lastMessage?.parts?.find(
            (p: any) =>
              isInteractiveToolPart(p) &&
              'state' in p &&
              p.state === 'output-available'
          ) as { toolCallId: string; output: unknown } | undefined

          if (resolvedPart && resolvedPart.output !== undefined) {
            return {
              body: {
                trigger: 'tool-result',
                chatId,
                toolResult: {
                  toolCallId: resolvedPart.toolCallId,
                  output: resolvedPart.output
                },
                // Guest: include full messages (already resolved by addToolResult)
                // so the ephemeral stream can continue without DB access
                ...(isGuest ? { messages } : {})
              }
            }
          }

          // No valid resolved part found — fall through to the normal request
          // path rather than sending an invalid tool-result continuation
          console.warn(
            '[chat] tool-result continuation: no resolved part found, falling back to normal request'
          )
        }

        return {
          body: {
            trigger,
            chatId,
            messageId,
            ...(isGuest ? { messages } : {}),
            message:
              trigger === 'regenerate-message' &&
              messageToRegenerate?.role === 'user'
                ? messageToRegenerate
                : trigger === 'submit-message'
                  ? lastMessage
                  : undefined,
            isNewChat:
              trigger === 'submit-message' &&
              messages.length === 1 &&
              savedMessages.length === 0
          }
        }
      }
    }),
    messages: savedMessages,
    onFinish: () => {
      window.dispatchEvent(new CustomEvent('chat-history-updated'))
    },
    onError: error => {
      // Parse structured error code from JSON response
      let errorCode = ''
      let errorMessage = error.message || 'An error occurred'
      try {
        const jsonMatch = error.message?.match(/\{[^{}]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          errorCode = parsed.code || ''
          errorMessage = parsed.error || errorMessage
        }
      } catch {
        // Fall through to legacy detection
      }

      const lowerMessage = errorMessage.toLowerCase()

      // Structured code matching (preferred), with legacy string fallback
      const isRateLimit =
        errorCode === 'RATE_LIMIT' ||
        errorCode === 'GUEST_LIMIT' ||
        error.message?.includes('429') ||
        lowerMessage.includes('rate limit') ||
        lowerMessage.includes('too many requests') ||
        lowerMessage.includes('daily limit')

      const isAuthError =
        errorCode === 'AUTH_REQUIRED' ||
        error.message?.includes('401') ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('authentication required')

      const isForbidden =
        errorCode === 'FORBIDDEN' ||
        error.message?.includes('403') ||
        lowerMessage.includes('forbidden')

      const isToolError =
        errorCode === 'TOOL_ERROR' ||
        lowerMessage.includes('tool part') ||
        lowerMessage.includes('assistant message') ||
        lowerMessage.includes('toolcallid') ||
        lowerMessage.includes('tool-result') ||
        lowerMessage.includes('has no messages')

      if (isRateLimit) {
        setErrorModal({
          open: true,
          type: 'rate-limit',
          message: errorMessage,
          details: undefined
        })
      } else if (isAuthError) {
        setErrorModal({
          open: true,
          type: 'auth',
          message: errorMessage
        })
      } else if (isForbidden) {
        setErrorModal({
          open: true,
          type: 'forbidden',
          message: errorMessage
        })
      } else if (isToolError) {
        // Tool-result continuation errors need persistent visibility — a toast
        // auto-dismisses in ~4s and users miss it, leaving them with no feedback
        setErrorModal({
          open: true,
          type: 'general',
          message: `Tool continuation failed: ${errorMessage}`
        })
      } else {
        // For general errors, still use toast for less intrusive notification
        toast.error(`Error in chat: ${errorMessage}`)
      }
    },
    sendAutomaticallyWhen: ({ messages: msgs }) => {
      const lastMsg = msgs[msgs.length - 1]
      if (!lastMsg || lastMsg.role !== 'assistant') return false
      const parts = lastMsg.parts
      if (!parts) return false
      // Check if any interactive tool parts are still pending (waiting for user input)
      const hasPendingTools = parts.some(
        p =>
          isInteractiveToolPart(p) &&
          'state' in p &&
          p.state === 'input-available' &&
          !('output' in p)
      )
      if (hasPendingTools) return false
      // Auto-continue when a displayOptionList has been resolved with a selection.
      // Use a ref to track which toolCallIds have already triggered auto-send
      // to prevent re-triggering on subsequent evaluations.
      const resolvedOptionPart = parts.find(
        (p: any) =>
          isInteractiveToolPart(p) &&
          'state' in p &&
          p.state === 'output-available'
      ) as { toolCallId: string } | undefined
      if (!resolvedOptionPart) return false
      if (autoSendFiredRef.current.has(resolvedOptionPart.toolCallId))
        return false
      autoSendFiredRef.current.add(resolvedOptionPart.toolCallId)
      return true
    },
    experimental_throttle: 100,
    generateId
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  // Convert messages array to sections array
  const sections = useMemo<ChatSection[]>(() => {
    const result: ChatSection[] = []
    let currentSection: ChatSection | null = null

    for (const message of messages) {
      if (message.role === 'user') {
        // Start a new section when a user message is found
        if (currentSection) {
          result.push(currentSection)
        }
        currentSection = {
          id: message.id,
          userMessage: message,
          assistantMessages: []
        }
      } else if (currentSection && message.role === 'assistant') {
        // Add assistant message to the current section
        currentSection.assistantMessages.push(message)
      }
      // Ignore other role types like 'system' for now
    }

    // Add the last section if exists
    if (currentSection) {
      result.push(currentSection)
    }

    return result
  }, [messages])

  // Listen for sidebar "New" / logo click to reset chat state
  useEffect(() => {
    const onNewChatRequested = () => handleNewChat()
    window.addEventListener('new-chat-requested', onNewChatRequested)
    return () =>
      window.removeEventListener('new-chat-requested', onNewChatRequested)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Dispatch custom event when messages change
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('messages-changed', {
        detail: { hasMessages: messages.length > 0 }
      })
    )
  }, [messages.length])

  // Detect if scroll container is at the bottom
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const checkIsAtBottom = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const threshold = 50
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < threshold)
    }

    container.addEventListener('scroll', checkIsAtBottom, { passive: true })
    checkIsAtBottom() // Set initial state

    // Also re-check when content grows (e.g., during streaming)
    const content = container.firstElementChild
    const observer = content ? new ResizeObserver(checkIsAtBottom) : null
    if (content) observer!.observe(content)

    return () => {
      container.removeEventListener('scroll', checkIsAtBottom)
      observer?.disconnect()
    }
  }, [messages.length])

  // Scroll to the section when a new user message is sent
  useEffect(() => {
    // Only scroll if this chat is currently visible in the URL
    const isCurrentChat =
      window.location.pathname === `/search/${chatId}` ||
      (window.location.pathname === '/' && sections.length > 0)

    if (isCurrentChat && sections.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.role === 'user') {
        // If the last message is from user, find the corresponding section
        const sectionId = lastMessage.id
        requestAnimationFrame(() => {
          const sectionElement = document.getElementById(`section-${sectionId}`)
          sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    }
  }, [sections, messages, chatId])

  const onQuerySelect = (query: string) => {
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: query }]
    })
  }

  const handleUpdateAndReloadMessage = async (
    editedMessageId: string,
    newContentText: string
  ) => {
    if (!chatId) {
      toast.error('Chat ID is missing.')
      console.error('handleUpdateAndReloadMessage: chatId is undefined.')
      return
    }

    try {
      // Update the message locally with the same ID
      setMessages(prevMessages => {
        const messageIndex = prevMessages.findIndex(
          m => m.id === editedMessageId
        )
        if (messageIndex === -1) return prevMessages

        const updatedMessages = [...prevMessages]
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          parts: [{ type: 'text', text: newContentText }]
        }

        return updatedMessages
      })

      // Regenerate from this message
      await regenerate({ messageId: editedMessageId })
    } catch (error) {
      console.error('Error during message edit and reload process:', error)
      toast.error(
        `Error processing edited message: ${(error as Error).message}`
      )
    }
  }

  const handleReloadFrom = async (reloadFromFollowerMessageId: string) => {
    if (!chatId) {
      toast.error('Chat ID is missing for reload.')
      return
    }

    try {
      // Use the SDK's regenerate function with the specific messageId
      await regenerate({ messageId: reloadFromFollowerMessageId })
    } catch (error) {
      console.error(
        `Error during reload from message ${reloadFromFollowerMessageId}:`,
        error
      )
      toast.error(`Failed to reload conversation: ${(error as Error).message}`)
    }
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const uploaded = uploadedFiles.filter(f => f.status === 'uploaded')

    if (input.trim() || uploaded.length > 0) {
      const parts: any[] = []

      if (input.trim()) {
        parts.push({ type: 'text', text: input })
      }

      uploaded.forEach(f => {
        parts.push({
          type: 'file',
          url: f.url!,
          filename: f.name!,
          mediaType: f.file.type
        })
      })

      sendMessage({ role: 'user', parts })
      setInput('')
      setUploadedFiles([])

      // Push URL state immediately after sending message (for new chats)
      // Check if we're on the root path (new chat)
      if (!isGuest && window.location.pathname === '/') {
        window.history.pushState({}, '', `/search/${chatId}`)
      }
    }
  }

  const { isDragging, handleDragOver, handleDragLeave, handleDrop } =
    useFileDropzone({
      uploadedFiles,
      setUploadedFiles,
      chatId: chatId
    })
  const guestDragHandlers = {
    isDragging: false,
    handleDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
    },
    handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
    },
    handleDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
    }
  }
  const dragHandlers = isGuest
    ? guestDragHandlers
    : { isDragging, handleDragOver, handleDragLeave, handleDrop }

  return (
    <div
      className={cn(
        'relative flex h-full min-w-0 flex-1 flex-col',
        messages.length === 0 ? 'items-center justify-center pb-[5vh]' : ''
      )}
      data-testid="full-chat"
      onDragOver={dragHandlers.handleDragOver}
      onDragLeave={dragHandlers.handleDragLeave}
      onDrop={dragHandlers.handleDrop}
    >
      <ChatMessages
        sections={sections}
        onQuerySelect={onQuerySelect}
        status={status}
        chatId={chatId}
        isGuest={isGuest}
        addToolResult={({
          toolCallId,
          result
        }: {
          toolCallId: string
          result: any
        }) => {
          // Find the tool name from the message parts
          let toolName = 'unknown'
          const matchedPart = messages
            .flatMap(m => m.parts ?? [])
            .find(
              p =>
                (isToolCallPart(p) ||
                  isToolTypePart(p) ||
                  isDynamicToolPart(p)) &&
                p.toolCallId === toolCallId
            )
          if (matchedPart) {
            if (isToolCallPart(matchedPart) || isDynamicToolPart(matchedPart)) {
              toolName = matchedPart.toolName
            } else if (isToolTypePart(matchedPart)) {
              toolName = matchedPart.type.substring(5) // Remove 'tool-' prefix
            }
          }

          addToolResult({ tool: toolName, toolCallId, output: result })
        }}
        scrollContainerRef={scrollContainerRef}
        onUpdateMessage={handleUpdateAndReloadMessage}
        reload={handleReloadFrom}
        error={error}
      />
      <ChatPanel
        chatId={chatId}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={onSubmit}
        status={status}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        query={query}
        append={(message: any) => {
          sendMessage(message)
        }}
        showScrollToBottomButton={!isAtBottom}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        scrollContainerRef={scrollContainerRef}
        onNewChat={handleNewChat}
        isGuest={isGuest}
      />
      <DragOverlay visible={dragHandlers.isDragging} />
      <ErrorModal
        open={errorModal.open}
        onOpenChange={open => setErrorModal(prev => ({ ...prev, open }))}
        error={errorModal}
        onRetry={
          errorModal.type !== 'rate-limit'
            ? () => {
                // Retry the last message if not rate limited
                if (messages.length > 0) {
                  const lastUserMessage = messages
                    .filter(m => m.role === 'user')
                    .pop()
                  if (lastUserMessage) {
                    sendMessage(lastUserMessage)
                  }
                }
              }
            : undefined
        }
        onAuthClose={() => {
          // Clear messages and navigate to root
          setMessages([])
          router.push('/')
        }}
      />
    </div>
  )
}
