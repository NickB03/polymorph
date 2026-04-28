'use client'

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState
} from 'react'
import { useRouter } from 'next/navigation'

import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls
} from 'ai'
import { toast } from 'sonner'

import { generateId } from '@/lib/db/schema'
import { HydrationAnimationProvider } from '@/lib/motion/hydration-boundary'
import { collectInitialPartIds } from '@/lib/motion/part-ids'
import { UploadedFile } from '@/lib/types'
import type {
  CanvasArtifactData,
  CanvasArtifactStatusData,
  ChatSection,
  UIMessage,
  UIMessageMetadata
} from '@/lib/types/ai'
import {
  isDynamicToolPart,
  isToolCallPart,
  isToolTypePart
} from '@/lib/types/dynamic-tools'
import { isValidModelType } from '@/lib/types/model-type'
import { isValidUserMode } from '@/lib/types/search'
import { cn } from '@/lib/utils'
import { syncModelType } from '@/lib/utils/model-type'
import { syncSearchMode } from '@/lib/utils/search-mode'
import { isVoiceEnabled } from '@/lib/voice/config'

import { useFileDropzone } from '@/hooks/use-file-dropzone'
import { useVoiceConversation } from '@/hooks/use-voice-conversation'

import { useSidebar } from '@/components/ui/sidebar'

import { useCanvas } from './canvas/canvas-context'
import { VoiceOrb } from './voice/voice-orb'
import { loadVoiceConfig } from './voice/voice-settings'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'
import { buildChatRequestBody, getLatestGuestCanvasToken } from './chat-request'
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
  const canvas = useCanvas()
  const { isMobile, setOpenMobile } = useSidebar()

  // Track the latest guest canvas token from streamed/persisted parts
  const guestCanvasTokenRef = useRef<string | undefined>(undefined)
  // Tracks artifacts that have been successfully auto-opened during this
  // session. Used to prevent re-opening after user closes the workspace.
  // Populated reactively when canvas.artifact loads (not eagerly on attempt).
  const canvasOpenedRef = useRef<Set<string>>(new Set())
  // Tracks canvas tool call IDs that have already triggered synthetic
  // compile progress (avoids re-setting on every messages change).
  const canvasProgressInitRef = useRef<Set<string>>(new Set())
  // The startedAt timestamp from client-side "generating" detection,
  // carried over to real server-side compile-progress events so the
  // elapsed timer reflects the full duration including AI generation.
  const syntheticCompileStartRef = useRef<string | null>(null)
  // Stable ref for canvas actions so the auto-open effect doesn't depend
  // on the canvas context object (which changes on every state update).
  const canvasRef = useRef(canvas)
  // why: live-ref pattern — keep the ref in sync with the latest canvas on
  // every render so effects/event handlers read a current value without
  // adding canvas itself to their dependency arrays (the canvas object
  // changes every render).
  // eslint-disable-next-line react-hooks/refs -- keep latest canvas actions available without re-subscribing effects to canvas identity churn
  canvasRef.current = canvas

  // Mark artifacts as "opened" only after they've successfully loaded.
  // This ensures failed auto-opens are retried on the next messages change.
  const loadedArtifactId = canvas.artifact?.artifactId
  useEffect(() => {
    if (loadedArtifactId) {
      canvasOpenedRef.current.add(loadedArtifactId)
    }
  }, [loadedArtifactId])

  // Generate a stable chatId on the client side
  // - If providedId exists (e.g., /search/[id]), use it for existing chats
  // - Otherwise, generate a new ID (e.g., / homepage for new chats)
  const [chatId, setChatId] = useState(() => providedId || generateId())

  // Callback to reset chat state when user clicks "New" button
  const handleNewChat = () => {
    stop() // Cancel any in-flight stream before switching chat
    stopVoiceRef.current?.() // Stop voice mode (mic, TTS, overlay)
    const newId = generateId()
    setChatId(newId)
    // Clear other chat-related state that persists due to Next.js 16 component caching
    setInput('')
    setUploadedFiles([])
    setErrorModal({
      open: false,
      type: 'general',
      message: ''
    })
    syncSearchMode('search')
    syncModelType('speed')
    guestCanvasTokenRef.current = undefined
    canvasOpenedRef.current.clear()
    canvasProgressInitRef.current.clear()
    syntheticCompileStartRef.current = null
    canvas.setGuestCanvasToken(null)
    canvas.closeWorkspace()
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
      if (isValidUserMode(metadata?.userMode)) {
        syncSearchMode(metadata.userMode)
      }
      if (isValidModelType(metadata?.modelType)) {
        syncModelType(metadata.modelType)
      }
    } else {
      syncSearchMode('search')
      syncModelType('speed')
    }
  }, [providedId, savedMessages])

  // Initialize guest canvas token from saved messages
  useEffect(() => {
    if (savedMessages.length === 0) return

    const token = getLatestGuestCanvasToken(savedMessages)
    if (!token) return

    guestCanvasTokenRef.current = token
    canvasRef.current.setGuestCanvasToken(token)
  }, [savedMessages])

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const stopVoiceRef = useRef<(() => void) | null>(null)
  const lastVoiceErrorRef = useRef<string | null>(null)
  const lastVoiceNoticeRef = useRef<string | null>(null)
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

  const closeArtifactSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [isMobile, setOpenMobile])

  const {
    messages,
    status,
    setMessages,
    stop,
    sendMessage,
    regenerate,
    addToolOutput,
    error
  } = useChat({
    id: chatId, // use the client-generated or provided chatId
    // why: prepareSendMessagesRequest is invoked at request time (not render),
    // so reading the latest guest canvas token from a ref is exactly the
    // intended pattern — the lint rule cannot distinguish the syntactic
    // render location from the runtime callback invocation.
    // eslint-disable-next-line react-hooks/refs -- request-time transport callback must read the latest guest canvas token
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages, trigger, messageId }) =>
        buildChatRequestBody({
          messages: messages as UIMessage[],
          trigger,
          messageId,
          chatId,
          isGuest,
          savedMessagesCount: savedMessages.length,
          guestCanvasToken: guestCanvasTokenRef.current
        })
    }),
    messages: savedMessages,
    onData: dataPart => {
      if (
        dataPart.type !== 'data-canvasArtifactEvent' ||
        dataPart.data?.event !== 'compile-progress'
      ) {
        return
      }

      // Spread to avoid mutating the original payload
      const progress = { ...dataPart.data.payload }
      const cv = canvasRef.current

      // Carry over the startedAt from client-side "generating" detection
      // so the elapsed timer reflects the full duration including AI generation
      if (syntheticCompileStartRef.current) {
        progress.startedAt = syntheticCompileStartRef.current
      }

      if (progress.source === 'create') {
        closeArtifactSidebar()
        cv.setPendingWorkspace({
          artifactId: progress.artifactId,
          title: progress.title
        })
      }

      cv.setCompileProgress(progress)
    },
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
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    experimental_throttle: 100,
    generateId
  })

  useEffect(() => {
    const cv = canvasRef.current
    // When navigating to home (no chat ID), close the canvas workspace and bail out
    if (!providedId) {
      cv.closeWorkspace()
      return
    }
    if (providedId === chatId) return

    stop()
    stopVoiceRef.current?.()
    // why: URL-driven chat switch — syncing chatId (and the derived local
    // state below) from the route param is the one legitimate setState-in-
    // effect pattern the React docs call out (external-source subscription).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route param changes are an external source and must synchronously reset chat session state
    setChatId(providedId)
    setInput('')
    setUploadedFiles([])
    setErrorModal({
      open: false,
      type: 'general',
      message: ''
    })
    guestCanvasTokenRef.current = undefined
    canvasOpenedRef.current.clear()
    canvasProgressInitRef.current.clear()
    syntheticCompileStartRef.current = null
    cv.setGuestCanvasToken(null)
    cv.closeWorkspace()
  }, [chatId, providedId, stop])

  useEffect(() => {
    const handleCanvasAiUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ context?: string }>).detail
      const context = detail?.context?.trim()
      if (!context) return

      sendMessage({
        role: 'user',
        parts: [{ type: 'text', text: context }]
      })
    }

    window.addEventListener(
      'canvas-ai-update-requested',
      handleCanvasAiUpdate as EventListener
    )

    return () => {
      window.removeEventListener(
        'canvas-ai-update-requested',
        handleCanvasAiUpdate as EventListener
      )
    }
  }, [sendMessage])

  // Track canvas data parts from streaming messages.
  // Uses canvasRef (stable ref) instead of canvas directly so that canvas
  // state changes (isLoading, artifact, etc.) don't re-trigger this effect —
  // otherwise closing the workspace would re-fire the effect and immediately
  // re-open it because the data-canvasArtifact parts are still in messages.
  useEffect(() => {
    const cv = canvasRef.current
    const latestGuestCanvasToken =
      getLatestGuestCanvasToken(messages) ?? guestCanvasTokenRef.current
    const latestStatusByArtifactId = new Map<string, CanvasArtifactStatusData>()

    if (latestGuestCanvasToken) {
      guestCanvasTokenRef.current = latestGuestCanvasToken
      cv.setGuestCanvasToken(latestGuestCanvasToken)
    }

    // Track artifact IDs attempted in this effect run so that duplicate
    // data-canvasArtifact parts across messages don't trigger multiple opens.
    const attemptedThisRun = new Set<string>()

    for (const msg of messages) {
      if (msg.role !== 'assistant' || !msg.parts) continue
      for (const part of msg.parts) {
        const p = part as {
          type?: string
          data?: CanvasArtifactData | CanvasArtifactStatusData
        }

        if (p.type === 'data-canvasArtifactStatus') {
          const statusData = p.data as CanvasArtifactStatusData | undefined
          if (statusData?.artifactId) {
            latestStatusByArtifactId.set(statusData.artifactId, statusData)
          }
        }

        // Auto-open the canvas workspace when a new artifact part arrives.
        // canvasOpenedRef tracks successfully opened artifacts — once an
        // artifact has been opened and the user closes it, we don't re-open.
        // If the open hasn't succeeded yet (not in canvasOpenedRef), we
        // retry on each messages change until it does.
        if (p.type === 'data-canvasArtifact') {
          const artifactData = p.data as CanvasArtifactData | undefined
          if (
            artifactData?.artifactId &&
            (!isGuest || latestGuestCanvasToken) &&
            !canvasOpenedRef.current.has(artifactData.artifactId) &&
            !attemptedThisRun.has(artifactData.artifactId)
          ) {
            attemptedThisRun.add(artifactData.artifactId)
            closeArtifactSidebar()
            cv.openCanvasArtifact(
              artifactData.artifactId,
              latestGuestCanvasToken
            )
          }
        }
      }
    }

    if (cv.artifact) {
      const latestStatus = latestStatusByArtifactId.get(cv.artifact.artifactId)

      if (
        latestStatus &&
        (latestStatus.status !== cv.artifact.status ||
          latestStatus.draftRevision !== cv.artifact.draftRevision ||
          latestStatus.currentVersionId !== cv.artifact.currentVersionId ||
          latestStatus.updatedAt !== cv.artifact.updatedAt)
      ) {
        cv.setArtifact({
          ...cv.artifact,
          status: latestStatus.status,
          draftRevision: latestStatus.draftRevision,
          currentVersionId: latestStatus.currentVersionId,
          updatedAt: latestStatus.updatedAt,
          guestCanvasToken:
            latestStatus.guestCanvasToken ?? cv.artifact.guestCanvasToken
        })

        // Fetch full state (including compiled HTML) once compilation finishes.
        // Status events intentionally omit draftCompiledHtml (too large for SSE),
        // so we reload the full artifact to update the iframe preview.
        if (
          latestStatus.status === 'ready' ||
          latestStatus.status === 'compile_failed'
        ) {
          cv.reloadArtifact()
        }
      }
    }
  }, [messages, closeArtifactSidebar, isGuest])

  // Detect streaming canvas tool calls and show the progress tracker early.
  // Without this, the tracker only appears during sub-second server-side
  // compilation. This makes it visible from the moment the AI starts
  // generating artifact code (the slow part the user actually waits for).
  useEffect(() => {
    const cv = canvasRef.current

    // Only during active streaming
    if (status !== 'streaming' && status !== 'submitted') {
      canvasProgressInitRef.current.clear()
      syntheticCompileStartRef.current = null
      return
    }

    const latestMsg = messages[messages.length - 1]
    if (!latestMsg || latestMsg.role !== 'assistant') return

    for (const part of latestMsg.parts ?? []) {
      let isCreate = false
      let isUpdate = false
      let partState: string | undefined
      let partInput: Record<string, unknown> = {}
      let toolCallId: string | undefined

      const pAny = part as {
        type?: string
        state?: string
        input?: Record<string, unknown>
        toolCallId?: string
        toolName?: string
      }

      if (pAny.type === 'tool-createCanvasArtifact') {
        isCreate = true
        partState = pAny.state
        partInput = pAny.input ?? {}
        toolCallId = pAny.toolCallId
      } else if (pAny.type === 'tool-updateCanvasArtifact') {
        isUpdate = true
        partState = pAny.state
        partInput = pAny.input ?? {}
        toolCallId = pAny.toolCallId
      } else if (pAny.type === 'dynamic-tool') {
        if (pAny.toolName === 'createCanvasArtifact') {
          isCreate = true
        } else if (pAny.toolName === 'updateCanvasArtifact') {
          isUpdate = true
        }
        if (isCreate || isUpdate) {
          partState = pAny.state
          partInput = pAny.input ?? {}
          toolCallId = pAny.toolCallId
        }
      }

      if (!isCreate && !isUpdate) continue
      if (partState !== 'input-streaming' && partState !== 'input-available')
        continue
      if (!toolCallId || canvasProgressInitRef.current.has(toolCallId)) continue

      canvasProgressInitRef.current.add(toolCallId)

      const source = isCreate ? ('create' as const) : ('update' as const)
      const artifactId = isUpdate
        ? (partInput.artifactId as string) || cv.artifactId || 'pending'
        : 'pending-create'
      const title =
        (partInput.title as string) || cv.artifact?.title || 'Canvas Artifact'
      const startedAt = new Date().toISOString()
      syntheticCompileStartRef.current = startedAt

      if (isCreate) {
        closeArtifactSidebar()
        cv.setPendingWorkspace({ artifactId, title })
      }

      cv.setCompileProgress({
        artifactId,
        title,
        source,
        startedAt,
        steps: [
          { id: 'generate', label: 'Generating code', status: 'in-progress' },
          { id: 'validate', label: 'Validating source', status: 'pending' },
          {
            id: 'bundle',
            label: 'Building React components',
            status: 'pending'
          },
          {
            id: 'tailwind',
            label: 'Compiling Tailwind styles',
            status: 'pending'
          },
          { id: 'assemble', label: 'Bundling output', status: 'pending' }
        ]
      })

      break // Only handle the first streaming canvas tool
    }
  }, [messages, status, closeArtifactSidebar])

  // Canvas callbacks for RenderMessage → ChatMessages
  const handleCanvasArtifactClick = useCallback(
    (artifactId: string) => {
      closeArtifactSidebar()
      canvas.focusCanvasArtifact(artifactId)
    },
    [canvas, closeArtifactSidebar]
  )

  const handleLegacyArtifactClick = useCallback(
    (artifactId: string) => {
      closeArtifactSidebar()
      canvas.openLegacyCanvasNotice({
        artifactId,
        source: 'chat-history'
      })
    },
    [canvas, closeArtifactSidebar]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  // Convert messages array to sections array, deduplicating by user message ID
  // to prevent React key collisions during streaming reconciliation.
  const sections = useMemo<ChatSection[]>(() => {
    const result: ChatSection[] = []
    let currentSection: ChatSection | null = null
    const seenUserIds = new Set<string>()
    let currentAssistantIds = new Set<string>()

    for (const message of messages) {
      if (message.role === 'user') {
        // Skip duplicate user messages (can occur during auto-continuations
        // or error retries when the SDK re-adds messages with existing IDs)
        if (seenUserIds.has(message.id)) continue
        seenUserIds.add(message.id)

        if (currentSection) {
          result.push(currentSection)
        }
        currentSection = {
          id: message.id,
          userMessage: message,
          assistantMessages: []
        }
        currentAssistantIds = new Set<string>()
      } else if (currentSection && message.role === 'assistant') {
        if (currentAssistantIds.has(message.id)) continue
        currentAssistantIds.add(message.id)
        currentSection.assistantMessages.push(message)
      }
    }

    if (currentSection) {
      result.push(currentSection)
    }

    return result
  }, [messages])

  const handleNewChatRequested = useEffectEvent(() => {
    handleNewChat()
  })

  // Listen for sidebar "New" / logo click to reset chat state
  useEffect(() => {
    const onNewChatRequested = () => handleNewChatRequested()
    window.addEventListener('new-chat-requested', onNewChatRequested)
    return () =>
      window.removeEventListener('new-chat-requested', onNewChatRequested)
  }, [])

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
      chatId: chatId,
      isGuest
    })
  const dragHandlers = {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }

  // Voice conversation loop (Phase 3) — hook is always called (React rules)
  // but UI is only rendered when NEXT_PUBLIC_ENABLE_VOICE=true
  const voiceConfig = useMemo(() => loadVoiceConfig(), [])
  const voiceConversation = useVoiceConversation({
    sendMessage: msg => sendMessage(msg),
    status,
    messages,
    config: voiceConfig
  })
  // why: late-bound callback — handleNewChat (declared above useChat/useVoice)
  // needs to stop the voice loop, but useVoiceConversation can only be set up
  // after useChat returns sendMessage. A ref bridges the cycle; writing it in
  // render is the intentional pattern for exposing the stopVoice handle.
  // eslint-disable-next-line react-hooks/refs, react-hooks/immutability -- expose the latest stopVoice handler to callbacks declared before the voice hook initializes
  stopVoiceRef.current = voiceConversation.stopVoice
  const voiceEnabled = isVoiceEnabled()

  useEffect(() => {
    if (!voiceConversation.voiceError) {
      lastVoiceErrorRef.current = null
      return
    }

    const fingerprint = `${voiceConversation.voiceError.code}:${voiceConversation.voiceError.message}`
    if (lastVoiceErrorRef.current === fingerprint) return

    lastVoiceErrorRef.current = fingerprint
    toast.error(voiceConversation.voiceError.message)
  }, [voiceConversation.voiceError])

  useEffect(() => {
    if (!voiceConversation.voiceNotice) {
      lastVoiceNoticeRef.current = null
      return
    }

    const fingerprint = `${voiceConversation.voiceNotice.code}:${voiceConversation.voiceNotice.message}`
    if (lastVoiceNoticeRef.current === fingerprint) return

    lastVoiceNoticeRef.current = fingerprint
    toast(voiceConversation.voiceNotice.message)
  }, [voiceConversation.voiceNotice])

  const initialPartIds = useMemo(
    () => collectInitialPartIds(savedMessages),
    [savedMessages]
  )

  return (
    <HydrationAnimationProvider initialPartIds={initialPartIds}>
      <div
        className={cn(
          'relative flex h-full min-w-0 flex-1 flex-col transition-all duration-500 ease-out',
          messages.length === 0
            ? 'items-center justify-start pt-16 md:justify-center md:pt-[8vh] md:pb-0'
            : ''
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
              if (
                isToolCallPart(matchedPart) ||
                isDynamicToolPart(matchedPart)
              ) {
                toolName = matchedPart.toolName
              } else if (isToolTypePart(matchedPart)) {
                toolName = matchedPart.type.substring(5) // Remove 'tool-' prefix
              }
            }

            addToolOutput({ tool: toolName, toolCallId, output: result })
          }}
          scrollContainerRef={scrollContainerRef}
          onUpdateMessage={handleUpdateAndReloadMessage}
          reload={handleReloadFrom}
          error={error}
          onCanvasArtifactClick={handleCanvasArtifactClick}
          onLegacyArtifactClick={handleLegacyArtifactClick}
        />
        <ChatPanel
          chatId={chatId}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={onSubmit}
          status={status}
          messages={messages}
          stop={stop}
          query={query}
          append={(message: any) => {
            sendMessage(message)
          }}
          showScrollToBottomButton={!isAtBottom}
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
          scrollContainerRef={scrollContainerRef}
          isGuest={isGuest}
          {...(voiceEnabled
            ? {
                voiceState: voiceConversation.voiceState,
                isVoiceActive: voiceConversation.isVoiceActive,
                onStartVoice: voiceConversation.startVoice,
                onStopVoice: voiceConversation.stopVoice
              }
            : {})}
        />
        {voiceEnabled && voiceConversation.isVoiceActive && (
          <VoiceOrb
            state={voiceConversation.voiceState}
            onStop={voiceConversation.stopVoice}
            interimTranscript={voiceConversation.interimTranscript}
            mediaStream={voiceConversation.mediaStream}
            audioElement={voiceConversation.audioElement}
          />
        )}
        <DragOverlay visible={dragHandlers.isDragging} />
        <ErrorModal
          open={errorModal.open}
          onOpenChange={open => setErrorModal(prev => ({ ...prev, open }))}
          error={errorModal}
          onRetry={
            errorModal.type !== 'rate-limit'
              ? () => {
                  // Retry by regenerating from the last user message.
                  // Using regenerate instead of sendMessage avoids re-adding
                  // the same message object (with its existing ID) as a duplicate.
                  if (messages.length > 0) {
                    const lastUserMessage = messages.findLast(
                      m => m.role === 'user'
                    )
                    if (lastUserMessage) {
                      regenerate({ messageId: lastUserMessage.id })
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
    </HydrationAnimationProvider>
  )
}
