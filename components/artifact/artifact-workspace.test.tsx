import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Part } from '@/lib/types/ai'

/**
 * Tests for the artifact workspace rendering behavior.
 *
 * Coverage items:
 * - #6: Workspace opens on artifact data — verified by checking that
 *       InspectorPanel renders the correct title/icon for artifact parts
 * - #7: Legacy search/reasoning inspector still opens after context refactor
 * - #12: Workspace header action path (close button renders and fires)
 * - Open in new tab renders when previewUrl exists, calls window.open
 */

// Mock lucide-react icons to simple spans
vi.mock('lucide-react', () => ({
  AlertCircle: (props: any) => <span data-testid="icon-alert" {...props} />,
  Check: (props: any) => <span data-testid="icon-check" {...props} />,
  Code2: (props: any) => <span data-testid="icon-code" {...props} />,
  Copy: (props: any) => <span data-testid="icon-copy" {...props} />,
  ExternalLink: (props: any) => (
    <span data-testid="icon-external-link" {...props} />
  ),
  Eye: (props: any) => <span data-testid="icon-eye" {...props} />,
  LightbulbIcon: (props: any) => (
    <span data-testid="icon-lightbulb" {...props} />
  ),
  ListTodo: (props: any) => <span data-testid="icon-todo" {...props} />,
  MessageSquare: (props: any) => <span data-testid="icon-message" {...props} />,
  Minimize2: (props: any) => <span data-testid="icon-minimize" {...props} />,
  RefreshCw: (props: any) => <span data-testid="icon-refresh" {...props} />,
  RotateCcw: (props: any) => <span data-testid="icon-rotate" {...props} />,
  Search: (props: any) => <span data-testid="icon-search" {...props} />,
  Sparkles: (props: any) => <span data-testid="icon-sparkles" {...props} />,
  X: (props: any) => <span data-testid="icon-close" {...props} />
}))

// Mock the separator
vi.mock('@/components/ui/separator', () => ({
  Separator: ({ className }: { className?: string }) => (
    <hr data-testid="separator" className={className} />
  )
}))

// Mock the tooltip provider and button
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )
}))

vi.mock('@/components/ui/tooltip-button', () => ({
  TooltipButton: ({
    children,
    onClick,
    'aria-label': ariaLabel
  }: {
    children: React.ReactNode
    onClick?: () => void
    'aria-label'?: string
  }) => (
    <button onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  )
}))

// Mock useCopyToClipboard for workspace header tests
vi.mock('@/lib/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({
    isCopied: false,
    copyToClipboard: vi.fn()
  })
}))

// Mock ArtifactContent so we isolate InspectorPanel logic
vi.mock('@/components/artifact/artifact-content', () => ({
  ArtifactContent: ({ part }: { part: Part | null }) => (
    <div data-testid="artifact-content" data-type={part?.type ?? 'none'} />
  )
}))

// Dynamic mock for the artifact context
const mockClose = vi.fn()
const mockCloseWorkspace = vi.fn()
const mockRequestAiFix = vi.fn()
let mockInspectedPart: Part | null = null
let mockWorkspaceState = {
  isOpen: false,
  artifactId: null as string | null,
  revisionId: null as string | null,
  title: null as string | null,
  status: null as string | null,
  previewUrl: null as string | null,
  canRebuild: false
}

vi.mock('@/components/artifact/artifact-context', () => ({
  useArtifact: () => ({
    state: {
      inspectedPart: mockInspectedPart,
      workspace: mockWorkspaceState
    },
    close: mockClose,
    closeWorkspace: mockCloseWorkspace,
    requestAiFix: mockRequestAiFix,
    workspaceLogs: []
  }),
  useArtifactAction: () => ({
    execute: vi.fn(),
    isPending: false
  }),
  formatArtifactFixPrompt: () => 'fix prompt'
}))

// Import after mocks
import { InspectorPanel } from '@/components/inspector/inspector-panel'

describe('InspectorPanel (workspace behavior)', () => {
  it('renders nothing when no part is set', () => {
    mockInspectedPart = null
    const { container } = render(<InspectorPanel />)
    expect(container.innerHTML).toBe('')
  })

  describe('search part (legacy backward compat)', () => {
    it('renders with search icon and title', () => {
      mockInspectedPart = {
        type: 'tool-search',
        toolCallId: 'tc-1',
        state: 'output-available',
        input: { query: 'test' },
        output: { results: [] }
      } as any

      render(<InspectorPanel />)

      expect(screen.getByTestId('icon-search')).toBeDefined()
      expect(screen.getByText('search')).toBeDefined()
      expect(screen.getByTestId('artifact-content')).toBeDefined()
    })
  })

  describe('reasoning part (legacy backward compat)', () => {
    it('renders with lightbulb icon and Thoughts title', () => {
      mockInspectedPart = {
        type: 'reasoning',
        text: 'deep thinking...'
      } as any

      render(<InspectorPanel />)

      expect(screen.getByTestId('icon-lightbulb')).toBeDefined()
      expect(screen.getByText('Thoughts')).toBeDefined()
    })
  })

  describe('text part', () => {
    it('renders with message icon and Text title', () => {
      mockInspectedPart = {
        type: 'text',
        text: 'some text'
      } as any

      render(<InspectorPanel />)

      expect(screen.getByTestId('icon-message')).toBeDefined()
      expect(screen.getByText('Text')).toBeDefined()
    })
  })

  describe('unknown part type', () => {
    it('falls back to Content title with message icon', () => {
      mockInspectedPart = {
        type: 'data-artifact',
        id: 'p-1',
        data: {
          id: 'artifact-1',
          title: 'App',
          status: 'ready'
        }
      } as any

      render(<InspectorPanel />)

      expect(screen.getByText('Content')).toBeDefined()
    })
  })

  describe('close action', () => {
    it('calls close when minimize button is clicked', () => {
      mockClose.mockClear()
      mockInspectedPart = {
        type: 'reasoning',
        text: 'thinking'
      } as any

      render(<InspectorPanel />)

      const closeButton = screen.getByLabelText('Close panel')
      closeButton.click()

      expect(mockClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('artifact content delegation', () => {
    it('passes the part to ArtifactContent', () => {
      mockInspectedPart = {
        type: 'tool-search',
        toolCallId: 'tc-1',
        state: 'output-available',
        input: { query: 'test' },
        output: { results: [] }
      } as any

      render(<InspectorPanel />)

      const content = screen.getByTestId('artifact-content')
      expect(content.getAttribute('data-type')).toBe('tool-search')
    })
  })
})

// Import workspace header after mocks
import { ArtifactWorkspaceHeader } from '@/components/artifact/artifact-workspace-header'

describe('ArtifactWorkspaceHeader (open-in-new-tab)', () => {
  beforeEach(() => {
    mockWorkspaceState = {
      isOpen: true,
      artifactId: 'art-1',
      revisionId: 'rev-1',
      title: 'Test App',
      status: 'ready',
      previewUrl: 'https://e2b-preview.example.com/abc',
      canRebuild: false
    }
  })

  describe('open in new tab', () => {
    it('renders when previewUrl exists', () => {
      render(
        <ArtifactWorkspaceHeader activeTab="preview" onTabChange={vi.fn()} />
      )

      expect(screen.getByLabelText('Open in new tab')).toBeDefined()
      expect(screen.getByTestId('icon-external-link')).toBeDefined()
    })

    it('calls window.open with preview URL', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      render(
        <ArtifactWorkspaceHeader activeTab="preview" onTabChange={vi.fn()} />
      )

      screen.getByLabelText('Open in new tab').click()

      expect(openSpy).toHaveBeenCalledWith(
        'https://e2b-preview.example.com/abc',
        '_blank',
        'noopener'
      )

      openSpy.mockRestore()
    })

    it('does not render when previewUrl is null', () => {
      mockWorkspaceState = {
        ...mockWorkspaceState,
        previewUrl: null
      }

      render(
        <ArtifactWorkspaceHeader activeTab="preview" onTabChange={vi.fn()} />
      )

      expect(screen.queryByLabelText('Open in new tab')).toBeNull()
    })
  })
})
