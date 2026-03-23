import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ChatPanel } from './chat-panel'

vi.mock('@/hooks/use-trending-suggestions', () => ({
  useTrendingSuggestions: () => ({
    suggestions: []
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

vi.mock('./action-buttons', () => ({
  ActionButtons: () => null
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
})
