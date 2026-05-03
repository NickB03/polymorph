import { createElement } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ChatPanel } from './chat-panel'

vi.mock('@/hooks/use-trending-suggestions', () => ({
  useTrendingSuggestions: () => ({
    suggestions: {
      research: ['Research prompt'],
      compare: ['Compare prompt'],
      latest: ['Latest prompt'],
      summarize: ['Summarize prompt'],
      explain: ['Explain prompt']
    }
  })
}))

vi.mock('@/lib/voice/config', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/voice/config')>(
      '@/lib/voice/config'
    )

  return {
    ...actual,
    isVoiceEnabled: () => false
  }
})

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, alt = '', ...rest } = props
    return createElement('img', {
      alt: typeof alt === 'string' ? alt : '',
      'data-fill': fill ? 'true' : undefined,
      ...rest
    })
  }
}))

vi.mock('./file-upload-button', () => ({
  FileUploadButton: () => null
}))

vi.mock('./uploaded-file-list', () => ({
  UploadedFileList: () => null
}))

vi.mock('./voice/voice-mode-toggle', () => ({
  VoiceModeToggle: () => null
}))

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

describe('ChatPanel', () => {
  it('does not render the legacy speed and quality selector', () => {
    render(
      <ChatPanel
        chatId="chat-1"
        input=""
        handleInputChange={vi.fn()}
        handleSubmit={e => e.preventDefault()}
        status="ready"
        messages={[]}
        stop={vi.fn()}
        append={vi.fn()}
        showScrollToBottomButton={false}
        scrollContainerRef={{ current: null }}
        uploadedFiles={[]}
        setUploadedFiles={vi.fn()}
        isGuest
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    expect(screen.queryByText('Speed')).not.toBeInTheDocument()
    expect(screen.queryByText('Quality')).not.toBeInTheDocument()
  })

  it('renders research and build action buttons in the empty-state composer', () => {
    render(
      <ChatPanel
        chatId="chat-1"
        input=""
        handleInputChange={vi.fn()}
        handleSubmit={e => e.preventDefault()}
        status="ready"
        messages={[]}
        stop={vi.fn()}
        append={vi.fn()}
        showScrollToBottomButton={false}
        scrollContainerRef={{ current: null }}
        uploadedFiles={[]}
        setUploadedFiles={vi.fn()}
        isGuest
      />
    )

    expect(
      screen.getByRole('button', { name: /research/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /build/i })).toBeInTheDocument()
  })

  it('moves prompt suggestions above the composer after a category is selected', () => {
    render(
      <ChatPanel
        chatId="chat-1"
        input=""
        handleInputChange={vi.fn()}
        handleSubmit={e => e.preventDefault()}
        status="ready"
        messages={[]}
        stop={vi.fn()}
        append={vi.fn()}
        showScrollToBottomButton={false}
        scrollContainerRef={{ current: null }}
        uploadedFiles={[]}
        setUploadedFiles={vi.fn()}
        isGuest
      />
    )

    const wordmark = screen.getByTestId('empty-state-wordmark')
    const shelf = screen.getByTestId('empty-state-action-buttons')
    expect(wordmark).toHaveClass('opacity-100')
    expect(shelf).toHaveClass('mt-2')

    fireEvent.click(screen.getByRole('button', { name: /compare/i }))

    expect(
      screen.getByRole('button', { name: /compare prompt/i })
    ).toBeInTheDocument()
    expect(shelf).toHaveClass('order-first')
    expect(shelf).toHaveClass('mb-2')
    expect(shelf).not.toHaveClass('mt-2')
    expect(wordmark).toHaveClass('opacity-0')
    expect(wordmark).toHaveClass('max-h-0')
    expect(wordmark).toHaveClass('pointer-events-none')

    vi.useFakeTimers()

    fireEvent.blur(screen.getByLabelText(/message input/i))
    fireEvent.focusOut(document)

    vi.advanceTimersByTime(150)

    expect(
      screen.getByRole('button', { name: /compare prompt/i })
    ).toBeInTheDocument()
    expect(shelf).toHaveClass('order-first')

    vi.useRealTimers()
  })
})

describe('file-only submit', () => {
  it('enables send button when files are uploaded even with empty input', () => {
    const mockSubmit = vi.fn(e => e.preventDefault())

    render(
      <ChatPanel
        chatId="test-chat"
        input=""
        handleInputChange={vi.fn()}
        handleSubmit={mockSubmit}
        status="ready"
        messages={[]}
        stop={vi.fn()}
        append={vi.fn()}
        showScrollToBottomButton={false}
        scrollContainerRef={{ current: null }}
        uploadedFiles={[
          {
            file: new File(['test'], 'photo.png', { type: 'image/png' }),
            status: 'uploaded' as const,
            url: 'https://example.com/photo.png',
            name: 'photo.png'
          }
        ]}
        setUploadedFiles={vi.fn()}
      />
    )

    const sendButton = screen.getByRole('button', { name: /send message/i })
    expect(sendButton).not.toBeDisabled()
  })
})
