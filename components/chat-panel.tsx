'use client'

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'

import { UseChatHelpers } from '@ai-sdk/react'
import { ArrowUp, ChevronDown, Square } from 'lucide-react'
import { toast } from 'sonner'

import { UploadedFile } from '@/lib/types'
import type { ToolPart, UIDataTypes, UIMessage, UITools } from '@/lib/types/ai'
import { cn, isChatLoading } from '@/lib/utils'
import {
  isAllowedUploadType,
  MAX_UPLOAD_SIZE_BYTES
} from '@/lib/utils/file-validation'
import { syncModelType } from '@/lib/utils/model-type'
import { syncSearchMode } from '@/lib/utils/search-mode'
import type { VoiceState } from '@/lib/voice/config'
import { isVoiceEnabled } from '@/lib/voice/config'

import { useTrendingSuggestions } from '@/hooks/use-trending-suggestions'

import { Button } from './ui/button'
import { VoiceModeToggle } from './voice/voice-mode-toggle'
import { ActionButtons } from './action-buttons'
import { FileUploadButton, readFileAsDataUrl } from './file-upload-button'
import { ModeSelector } from './mode-selector'
import { PolymorphWordmark } from './polymorph-wordmark'
import { UploadedFileList } from './uploaded-file-list'

// Constants for timing delays
const INPUT_UPDATE_DELAY_MS = 10 // Delay to ensure input value is updated before form submission

interface ChatPanelProps {
  chatId: string
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  status: UseChatHelpers<UIMessage<unknown, UIDataTypes, UITools>>['status']
  messages: UIMessage[]
  query?: string
  stop: () => void
  append: (message: any) => void
  /** Whether to show the scroll to bottom button */
  showScrollToBottomButton: boolean
  /** Reference to the scroll container */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  uploadedFiles: UploadedFile[]
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  /** Whether the current session is guest */
  isGuest?: boolean
  /** Voice conversation state (from useVoiceConversation in Chat) */
  voiceState?: VoiceState
  isVoiceActive?: boolean
  onStartVoice?: () => void
  onStopVoice?: () => void
}

export function ChatPanel({
  chatId,
  input,
  handleInputChange,
  handleSubmit,
  status,
  messages,
  query,
  stop,
  append,
  showScrollToBottomButton,
  uploadedFiles,
  setUploadedFiles,
  scrollContainerRef,
  isGuest = false,
  voiceState,
  isVoiceActive = false,
  onStartVoice,
  onStopVoice
}: ChatPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false) // Composition state
  const [enterDisabled, setEnterDisabled] = useState(false) // Disable Enter after composition ends
  const [isInputFocused, setIsInputFocused] = useState(false) // Track input focus
  const [isActionPanelActive, setIsActionPanelActive] = useState(false)
  const { suggestions } = useTrendingSuggestions()
  const isLoading = isChatLoading(status)
  const voiceEnabled = isVoiceEnabled()
  const shouldShowWordmark = messages.length === 0 && !isActionPanelActive

  // Submit after a brief delay so React flushes the input state update first
  const submitPromptValue = (value: string) => {
    handleInputChange({
      target: { value }
    } as React.ChangeEvent<HTMLTextAreaElement>)
    setTimeout(() => {
      inputRef.current?.form?.requestSubmit()
      setIsInputFocused(false)
      inputRef.current?.blur()
    }, INPUT_UPDATE_DELAY_MS)
  }

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 300)
  }

  const appendInitialQuery = useEffectEvent((initialQuery: string) => {
    append({
      role: 'user',
      content: initialQuery
    })
  })

  const isToolInvocationInProgress = () => {
    if (!messages.length) return false

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant' || !lastMessage.parts) return false

    const parts = lastMessage.parts
    const lastPart = parts[parts.length - 1]

    if (lastPart?.type === 'tool-search' || lastPart?.type === 'tool-fetch') {
      const state = (lastPart as ToolPart).state
      return state === 'input-streaming' || state === 'input-available'
    }
    return false
  }

  // if query is not empty, submit the query
  useEffect(() => {
    if (!isFirstRender.current || !query || query.trim().length === 0) return

    appendInitialQuery(query)
    isFirstRender.current = false
  }, [query])

  const handleFileRemove = useCallback(
    (index: number) => {
      setUploadedFiles(prev => prev.filter((_, i) => i !== index))
    },
    [setUploadedFiles]
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items)
      const imageFiles = items
        .filter(item => item.kind === 'file' && isAllowedUploadType(item.type))
        .map(item => item.getAsFile()!)
        .filter(Boolean)

      if (imageFiles.length === 0) return

      // Prevent the default paste so the binary data doesn't end up in the textarea
      e.preventDefault()

      const maxFiles = 3
      const sizeValid = imageFiles.filter(f => f.size <= MAX_UPLOAD_SIZE_BYTES)
      const tooLarge = imageFiles.filter(f => f.size > MAX_UPLOAD_SIZE_BYTES)

      if (tooLarge.length > 0) {
        toast.error(
          'Files too large (max 5 MB): ' + tooLarge.map(f => f.name).join(', ')
        )
      }

      const available = maxFiles - uploadedFiles.length
      if (available <= 0) {
        toast.error(`You can upload a maximum of ${maxFiles} files.`)
        return
      }

      const filesToAdd = sizeValid.slice(0, available)
      if (filesToAdd.length === 0) return

      if (isGuest) {
        const results = await Promise.all(
          filesToAdd.map(async file => ({
            file,
            dataUrl: await readFileAsDataUrl(file)
          }))
        )
        const newFiles: UploadedFile[] = results.map(({ file, dataUrl }) => ({
          file,
          status: 'uploaded' as const,
          url: dataUrl,
          name: file.name,
          dataUrl
        }))
        setUploadedFiles(prev => [...prev, ...newFiles].slice(0, maxFiles))
      } else {
        const newFiles: UploadedFile[] = filesToAdd.map(file => ({
          file,
          status: 'uploading' as const
        }))
        setUploadedFiles(prev => [...prev, ...newFiles])
        await Promise.all(
          newFiles.map(async uf => {
            const formData = new FormData()
            formData.append('file', uf.file)
            formData.append('chatId', chatId)
            try {
              const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
              })
              if (!res.ok) throw new Error('Upload failed')
              const { file: uploaded } = await res.json()
              setUploadedFiles(prev =>
                prev.map(f =>
                  f.file === uf.file
                    ? {
                        ...f,
                        status: 'uploaded' as const,
                        url: uploaded.url,
                        name: uploaded.filename,
                        key: uploaded.key
                      }
                    : f
                )
              )
            } catch {
              toast.error(`Failed to upload ${uf.file.name}`)
              setUploadedFiles(prev =>
                prev.map(f =>
                  f.file === uf.file ? { ...f, status: 'error' as const } : f
                )
              )
            }
          })
        )
      }
    },
    [uploadedFiles, setUploadedFiles, chatId, isGuest]
  )
  // Scroll to the bottom of the container
  const handleScrollToBottom = () => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div
      data-empty-chat-panel={messages.length === 0 ? 'true' : undefined}
      className={cn(
        'w-full bg-background group/form-container shrink-0',
        messages.length > 0
          ? 'sticky bottom-0 px-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))]'
          : 'px-6'
      )}
    >
      {/* Wordmark - always rendered, fades out when messages appear */}
      <div
        data-testid="empty-state-wordmark"
        data-empty-chat-wordmark={messages.length === 0 ? 'true' : undefined}
        className={cn(
          'transition-all duration-500 ease-out overflow-hidden',
          shouldShowWordmark
            ? 'mb-6 flex flex-col items-center gap-4 opacity-100 max-h-20 scale-100'
            : 'mb-0 flex flex-col items-center gap-4 opacity-0 max-h-0 scale-95 pointer-events-none'
        )}
      >
        <PolymorphWordmark className="text-[2rem] md:text-[2.5rem]" />
      </div>
      {uploadedFiles.length > 0 && (
        <UploadedFileList files={uploadedFiles} onRemove={handleFileRemove} />
      )}
      <form
        onSubmit={e => {
          handleSubmit(e)
          // Reset focus state after submission
          setIsInputFocused(false)
          inputRef.current?.blur()
        }}
        className={cn(
          'max-w-full md:max-w-4xl w-full mx-auto relative flex flex-col transition-all duration-500 ease-out'
        )}
      >
        {/* Scroll to bottom button - only shown when showScrollToBottomButton is true */}
        {showScrollToBottomButton && messages.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute -top-10 right-4 z-20 size-8 rounded-full shadow-md"
            onClick={handleScrollToBottom}
            title="Scroll to bottom"
          >
            <ChevronDown size={16} />
          </Button>
        )}

        <div
          className={cn(
            'relative flex flex-col w-full gap-2 bg-muted rounded-3xl border border-input transition-shadow',
            isInputFocused &&
              'ring-1 ring-ring/20 ring-offset-1 ring-offset-background/50'
          )}
        >
          <Textarea
            ref={inputRef}
            name="input"
            rows={1}
            maxRows={5}
            tabIndex={0}
            aria-label="Message input"
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder="Ask anything..."
            spellCheck={false}
            value={input}
            disabled={isLoading || isToolInvocationInProgress()}
            className="resize-none w-full min-h-14 bg-transparent border-0 p-4 text-base placeholder:text-muted-foreground focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
            onChange={handleInputChange}
            onPaste={handlePaste}
            onKeyDown={e => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !isComposing &&
                !enterDisabled
              ) {
                if (
                  input.trim().length === 0 &&
                  !uploadedFiles.some(f => f.status === 'uploaded')
                ) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const textarea = e.target as HTMLTextAreaElement
                textarea.form?.requestSubmit()
                // Reset focus state after Enter key submission
                setIsInputFocused(false)
                textarea.blur()
              }
            }}
          />

          {/* Bottom menu area */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <FileUploadButton
                isGuest={isGuest}
                onGuestFileSelect={files => {
                  const newFiles: UploadedFile[] = files.map(
                    ({ file, dataUrl }) => ({
                      file,
                      status: 'uploaded' as const,
                      url: dataUrl,
                      name: file.name,
                      dataUrl
                    })
                  )
                  setUploadedFiles(prev => [...prev, ...newFiles].slice(0, 3))
                }}
                onFileSelect={async files => {
                  const newFiles: UploadedFile[] = files.map(file => ({
                    file,
                    status: 'uploading'
                  }))
                  setUploadedFiles(prev => [...prev, ...newFiles])
                  await Promise.all(
                    newFiles.map(async uf => {
                      const formData = new FormData()
                      formData.append('file', uf.file)
                      formData.append('chatId', chatId)
                      try {
                        const res = await fetch('/api/upload', {
                          method: 'POST',
                          body: formData
                        })

                        if (!res.ok) {
                          throw new Error('Upload failed')
                        }

                        const { file: uploaded } = await res.json()
                        setUploadedFiles(prev =>
                          prev.map(f =>
                            f.file === uf.file
                              ? {
                                  ...f,
                                  status: 'uploaded',
                                  url: uploaded.url,
                                  name: uploaded.filename,
                                  key: uploaded.key
                                }
                              : f
                          )
                        )
                      } catch (e) {
                        toast.error(`Failed to upload ${uf.file.name}`)
                        setUploadedFiles(prev =>
                          prev.map(f =>
                            f.file === uf.file ? { ...f, status: 'error' } : f
                          )
                        )
                      }
                    })
                  )
                }}
              />
              <ModeSelector />
            </div>
            <div className="flex items-center gap-2">
              {voiceEnabled && onStartVoice && onStopVoice && (
                <VoiceModeToggle
                  isActive={isVoiceActive}
                  onStart={onStartVoice}
                  onStop={onStopVoice}
                  disabled={isLoading}
                />
              )}
              <Button
                type={isLoading ? 'button' : 'submit'}
                size={'icon'}
                className={cn(isLoading && 'animate-pulse', 'rounded-full')}
                disabled={
                  input.length === 0 &&
                  !isLoading &&
                  !uploadedFiles.some(f => f.status === 'uploaded')
                }
                onClick={isLoading ? stop : undefined}
                aria-label={isLoading ? 'Stop generating' : 'Send message'}
              >
                {isLoading ? <Square size={20} /> : <ArrowUp size={20} />}
              </Button>
            </div>
          </div>
        </div>

        {/* Action buttons for prompt suggestions */}
        {messages.length === 0 && (
          <div
            data-testid="empty-state-action-buttons"
            data-empty-chat-suggestions="true"
            className={cn(
              'transition-[margin] duration-300',
              isActionPanelActive ? 'order-first mb-2' : 'mt-2'
            )}
          >
            <ActionButtons
              promptSamples={suggestions}
              canvasEnabled
              onActiveViewChange={activeView => {
                setIsActionPanelActive(activeView !== null)
              }}
              onSelectPrompt={(message, category) => {
                // Auto-switch to Research + Quality for research suggestions
                if (category === 'research') {
                  syncSearchMode('research')
                  syncModelType('quality')
                }
                submitPromptValue(message)
              }}
              onBuildTemplateSelect={prompt => {
                submitPromptValue(prompt)
              }}
              onCategoryClick={category => {
                // Set the category in the input
                handleInputChange({
                  target: { value: category }
                } as React.ChangeEvent<HTMLTextAreaElement>)
                // Focus the input
                inputRef.current?.focus()
              }}
              inputRef={inputRef}
            />
          </div>
        )}
      </form>
    </div>
  )
}
