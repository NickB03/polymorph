import React from 'react'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasArtifactState } from '@/lib/canvas/service'
import type {
  CanvasArtifactStatus,
  CanvasDiagnostics
} from '@/lib/types/canvas'

import type { ActivityState } from '@/components/activity/activity-context'

import type { CanvasContextValue } from './canvas-context'

// ── Mocks ────────────────────────────────────────────────────────────

// Track which mobile state the hook returns
let mockIsMobile = false
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockIsMobile
}))

// Canvas context mock — we control state from each test
const mockCanvasContext: CanvasContextValue = {
  artifactId: null,
  artifact: null,
  isLoading: false,
  isWorkspaceOpen: false,
  legacyNotice: null,
  guestCanvasToken: null,
  openCanvasArtifact: vi.fn(),
  focusCanvasArtifact: vi.fn(),
  openLegacyCanvasNotice: vi.fn(),
  closeWorkspace: vi.fn(),
  requestCanvasAiUpdate: vi.fn(),
  reloadArtifact: vi.fn(),
  setGuestCanvasToken: vi.fn(),
  setArtifact: vi.fn(),
  updateDraft: vi.fn(),
  saveVersion: vi.fn(),
  restoreVersion: vi.fn(),
  exportHtml: vi.fn(),
  viewFullscreen: vi.fn()
}

vi.mock('./canvas-context', () => ({
  useCanvas: () => mockCanvasContext
}))

const mockActivityState: ActivityState = {
  isOpen: false,
  isResearchMode: false,
  items: [],
  searchModeLabel: null
}

vi.mock('@/components/activity/activity-context', () => ({
  useActivity: () => ({
    state: mockActivityState,
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
    setResearchMode: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    reset: vi.fn()
  })
}))

vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await import('react')

  const DropdownMenuContext = React.createContext<{
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
  } | null>(null)

  function DropdownMenu({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)

    return (
      <DropdownMenuContext.Provider value={{ open, setOpen }}>
        {children}
      </DropdownMenuContext.Provider>
    )
  }

  function DropdownMenuTrigger({
    asChild,
    children
  }: {
    asChild?: boolean
    children: React.ReactElement
  }) {
    const ctx = React.useContext(DropdownMenuContext)
    if (!ctx) return children

    const child = React.Children.only(children) as React.ReactElement<{
      onClick?: (event: React.MouseEvent) => void
    }>
    return React.cloneElement(child, {
      onClick: (event: React.MouseEvent) => {
        child.props.onClick?.(event)
        ctx.setOpen(open => !open)
      }
    })
  }

  function DropdownMenuContent({
    children
  }: {
    children: React.ReactNode
    align?: string
  }) {
    const ctx = React.useContext(DropdownMenuContext)
    if (!ctx?.open) return null
    return <div>{children}</div>
  }

  function DropdownMenuItem({
    children,
    disabled,
    onClick,
    ...props
  }: {
    children: React.ReactNode
    disabled?: boolean
    onClick?: () => void
    [key: string]: unknown
  }) {
    return (
      <button
        type="button"
        data-disabled={disabled ? '' : undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onClick?.()
        }}
        {...props}
      >
        {children}
      </button>
    )
  }

  return {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
  }
})

// Mock CodeMirror — JSDOM does not support CM6
let mockCodeMirrorProps: Record<string, unknown> = {}
vi.mock('@uiw/react-codemirror', () => ({
  default: (props: Record<string, unknown>) => {
    mockCodeMirrorProps = props
    return (
      <textarea
        data-testid="canvas-codemirror"
        value={props.value as string}
        readOnly={props.readOnly as boolean}
        aria-readonly={(props.readOnly as boolean) ? 'true' : undefined}
        onChange={e => {
          const onChange = props.onChange as ((val: string) => void) | undefined
          onChange?.(e.target.value)
        }}
      />
    )
  },
  __esModule: true
}))

vi.mock('@codemirror/lang-javascript', () => ({
  javascript: () => []
}))

vi.mock('@codemirror/lang-css', () => ({
  css: () => []
}))

vi.mock('@codemirror/lang-json', () => ({
  json: () => []
}))

vi.mock('@codemirror/theme-one-dark', () => ({
  oneDark: {}
}))

// ── Helpers ──────────────────────────────────────────────────────────

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn()
  })
})

function makeArtifact(
  overrides: Partial<CanvasArtifactState> = {}
): CanvasArtifactState {
  return {
    artifactId: 'art-1',
    chatId: 'chat-1',
    title: 'My Artifact',
    status: 'ready' as CanvasArtifactStatus,
    draftRevision: 1,
    draftSource: { 'App.tsx': 'export default () => <div>Hello</div>' },
    draftCompiledHtml: '<html><body>Hello</body></html>',
    draftDiagnostics: null,
    currentVersionId: null,
    versions: [],
    updatedAt: '2026-03-19T00:00:00.000Z',
    ...overrides
  }
}

function setCanvasState(partial: Partial<CanvasContextValue>) {
  Object.assign(mockCanvasContext, partial)
}

function resetCanvasState() {
  Object.assign(mockCanvasContext, {
    artifactId: null,
    artifact: null,
    isLoading: false,
    isWorkspaceOpen: false,
    legacyNotice: null,
    guestCanvasToken: null
  })
  Object.assign(mockActivityState, {
    isOpen: false,
    isResearchMode: false,
    items: [],
    searchModeLabel: null
  })
  vi.clearAllMocks()
  mockCodeMirrorProps = {}
}

// ── Tests ────────────────────────────────────────────────────────────

// Lazy import to ensure mocks are applied before module loads
async function importWorkspace() {
  const mod = await import('./canvas-workspace')
  return mod.CanvasWorkspace
}

describe('CanvasWorkspace', () => {
  let CanvasWorkspace: Awaited<ReturnType<typeof importWorkspace>>

  beforeEach(async () => {
    mockIsMobile = false
    resetCanvasState()
    // Re-import to get fresh module with mocks applied
    CanvasWorkspace = await importWorkspace()
  })

  // ── Loading state ──────────────────────────────────────────────

  it('shows loading spinner when isLoading is true', () => {
    setCanvasState({ isLoading: true })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-loading')).toBeInTheDocument()
  })

  // ── Legacy notice ──────────────────────────────────────────────

  it('shows the legacy notice instead of a workspace for legacy references', () => {
    setCanvasState({
      legacyNotice: {
        kind: 'legacy-unavailable',
        artifactId: 'old-art-1',
        source: 'chat-history'
      }
    })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-legacy-notice')).toBeInTheDocument()
    expect(screen.getByText(/legacy artifact unavailable/i)).toBeInTheDocument()
  })

  // ── Active workspace ───────────────────────────────────────────

  it('shows workspace when artifact is loaded', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-workspace')).toBeInTheDocument()
    expect(screen.getByText('My Artifact')).toBeInTheDocument()
  })

  it('shows status badge', () => {
    const artifact = makeArtifact({ status: 'compiling' })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-status-badge')).toHaveTextContent(
      'Compiling'
    )
  })

  // ── Status badge visibility ────────────────────────────────────

  it('shows status badge when status is generating', () => {
    const artifact = makeArtifact({ status: 'generating' })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-status-badge')).toBeInTheDocument()
    expect(screen.getByText('Generating')).toBeInTheDocument()
  })

  it('shows status badge when status is restoring', () => {
    const artifact = makeArtifact({ status: 'restoring' })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-status-badge')).toBeInTheDocument()
  })

  it('hides status badge when status is ready', () => {
    const artifact = makeArtifact({ status: 'ready' })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.queryByTestId('canvas-status-badge')).not.toBeInTheDocument()
  })

  it('shows status badge when status is compile_failed', () => {
    const artifact = makeArtifact({ status: 'compile_failed' })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-status-badge')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  // ── Desktop pill tab layout ─────────────────────────────────────

  it('renders pill switcher and preview by default on desktop', () => {
    mockIsMobile = false
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-pill-switcher')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-pill-preview')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-pill-code')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-preview-slot')).toBeInTheDocument()
  })

  it('switches to code view when code pill is clicked', () => {
    mockIsMobile = false
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-pill-code'))

    expect(screen.getByTestId('canvas-code-sub-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-code-slot')).toBeInTheDocument()
    expect(screen.queryByTestId('canvas-preview-slot')).not.toBeInTheDocument()
  })

  it('switches back to preview when preview pill is clicked', () => {
    mockIsMobile = false
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    // Go to code
    fireEvent.click(screen.getByTestId('canvas-pill-code'))
    expect(screen.queryByTestId('canvas-preview-slot')).not.toBeInTheDocument()

    // Go back to preview
    fireEvent.click(screen.getByTestId('canvas-pill-preview'))
    expect(screen.getByTestId('canvas-preview-slot')).toBeInTheDocument()
  })

  it('shows an activity pill when activity items exist', () => {
    const artifact = makeArtifact()
    mockActivityState.items = [
      {
        id: 'search-1',
        type: 'search',
        data: {
          type: 'tool-search',
          toolCallId: 'search-1',
          state: 'input-available',
          input: { query: 'vana' }
        } as any,
        state: 'active',
        timestamp: Date.now()
      }
    ]
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-pill-activity')).toBeInTheDocument()
  })

  it('does not show an activity pill when there are no activity items', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.queryByTestId('canvas-pill-activity')).not.toBeInTheDocument()
  })

  it('switches to activity view when the activity pill is clicked', () => {
    const artifact = makeArtifact()
    mockActivityState.items = [
      {
        id: 'search-1',
        type: 'search',
        data: {
          type: 'tool-search',
          toolCallId: 'search-1',
          state: 'input-available',
          input: { query: 'vana' }
        } as any,
        state: 'active',
        timestamp: Date.now()
      }
    ]
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-pill-activity'))

    expect(screen.getByTestId('canvas-activity-slot')).toBeInTheDocument()
    expect(screen.queryByTestId('canvas-preview-slot')).not.toBeInTheDocument()
  })

  it('shows and clears the unseen activity indicator', async () => {
    const artifact = makeArtifact()
    const { rerender } = render(<CanvasWorkspace />)

    setCanvasState({ artifact, artifactId: artifact.artifactId })
    rerender(<CanvasWorkspace />)

    expect(
      screen.queryByTestId('canvas-pill-activity-unseen')
    ).not.toBeInTheDocument()

    mockActivityState.items = [
      {
        id: 'search-1',
        type: 'search',
        data: {
          type: 'tool-search',
          toolCallId: 'search-1',
          state: 'input-available',
          input: { query: 'vana' }
        } as any,
        state: 'active',
        timestamp: Date.now()
      }
    ]
    rerender(<CanvasWorkspace />)

    expect(
      screen.getByTestId('canvas-pill-activity-unseen')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('canvas-pill-activity'))

    await waitFor(() => {
      expect(
        screen.queryByTestId('canvas-pill-activity-unseen')
      ).not.toBeInTheDocument()
    })
  })

  it('returns to preview if activity disappears while activity tab is active', async () => {
    const artifact = makeArtifact()
    mockActivityState.items = [
      {
        id: 'search-1',
        type: 'search',
        data: {
          type: 'tool-search',
          toolCallId: 'search-1',
          state: 'input-available',
          input: { query: 'vana' }
        } as any,
        state: 'active',
        timestamp: Date.now()
      }
    ]
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    const { rerender } = render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-pill-activity'))
    expect(screen.getByTestId('canvas-activity-slot')).toBeInTheDocument()

    mockActivityState.items = []
    rerender(<CanvasWorkspace />)

    await waitFor(() => {
      expect(screen.getByTestId('canvas-preview-slot')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('canvas-pill-activity')).not.toBeInTheDocument()
  })

  // ── Desktop code sub-tabs ──────────────────────────────────────

  it('shows code sub-tabs when code pill is active', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-pill-code'))

    expect(screen.getByTestId('canvas-code-sub-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-code-sub-tab-code')).toBeInTheDocument()
    expect(
      screen.getByTestId('canvas-code-sub-tab-diagnostics')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('canvas-code-sub-tab-history')
    ).toBeInTheDocument()
  })

  it('switches to diagnostics sub-tab on desktop', () => {
    const artifact = makeArtifact({
      draftDiagnostics: {
        validation: [{ severity: 'error', message: 'Bad import' }],
        compile: [],
        runtime: [],
        externalDependencies: []
      }
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-pill-code'))
    fireEvent.click(screen.getByTestId('canvas-code-sub-tab-diagnostics'))

    expect(screen.getByTestId('canvas-diagnostics-slot')).toBeInTheDocument()
  })

  it('switches to history sub-tab on desktop', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-pill-code'))
    fireEvent.click(screen.getByTestId('canvas-code-sub-tab-history'))

    expect(screen.getByTestId('canvas-history-slot')).toBeInTheDocument()
  })

  // ── Mobile tab switching ───────────────────────────────────────

  it('renders tab bar on mobile with Preview active by default', () => {
    mockIsMobile = true
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-tab-preview')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-tab-code')).toBeInTheDocument()
    // Preview slot visible by default
    expect(screen.getByTestId('canvas-preview-slot')).toBeInTheDocument()
    expect(screen.queryByTestId('canvas-pill-switcher')).not.toBeInTheDocument()
  })

  it('switches to code tab on mobile', () => {
    mockIsMobile = true
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-tab-code'))

    expect(screen.getByTestId('canvas-code-slot')).toBeInTheDocument()
  })

  it('shows activity tab on mobile when activity items exist', () => {
    mockIsMobile = true
    const artifact = makeArtifact()
    mockActivityState.items = [
      {
        id: 'search-1',
        type: 'search',
        data: {
          type: 'tool-search',
          toolCallId: 'search-1',
          state: 'input-available',
          input: { query: 'vana' }
        } as any,
        state: 'active',
        timestamp: Date.now()
      }
    ]
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-tab-activity')).toBeInTheDocument()
  })

  it('shows and clears the unseen activity indicator on mobile', async () => {
    mockIsMobile = true
    const artifact = makeArtifact()
    const { rerender } = render(<CanvasWorkspace />)

    setCanvasState({ artifact, artifactId: artifact.artifactId })
    rerender(<CanvasWorkspace />)

    expect(
      screen.queryByTestId('canvas-tab-activity-unseen')
    ).not.toBeInTheDocument()

    mockActivityState.items = [
      {
        id: 'search-1',
        type: 'search',
        data: {
          type: 'tool-search',
          toolCallId: 'search-1',
          state: 'input-available',
          input: { query: 'vana' }
        } as any,
        state: 'active',
        timestamp: Date.now()
      }
    ]
    rerender(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-tab-activity-unseen')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('canvas-tab-activity'))

    await waitFor(() => {
      expect(
        screen.queryByTestId('canvas-tab-activity-unseen')
      ).not.toBeInTheDocument()
    })
  })

  // ── Close action ───────────────────────────────────────────────

  it('calls closeWorkspace on close button click', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-close'))

    expect(mockCanvasContext.closeWorkspace).toHaveBeenCalledTimes(1)
  })

  // ── Action buttons ─────────────────────────────────────────────

  it('renders overflow menu button', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-more-actions')).toBeInTheDocument()
  })

  it('calls exportHtml from the overflow menu', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-more-actions'))
    fireEvent.click(screen.getByTestId('canvas-export'))

    expect(mockCanvasContext.exportHtml).toHaveBeenCalledTimes(1)
  })

  it('disables exportHtml in the overflow menu when no compiled html exists', () => {
    const artifact = makeArtifact({ draftCompiledHtml: null })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-more-actions'))

    expect(screen.getByTestId('canvas-export')).toHaveAttribute(
      'data-disabled',
      ''
    )
  })

  it('renders close button with X icon', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    const closeBtn = screen.getByTestId('canvas-close')
    expect(closeBtn).toBeInTheDocument()
    expect(closeBtn).toHaveAttribute('aria-label', 'Close')
  })

  // ── Returns null when no data ──────────────────────────────────

  it('returns null when no artifact, no loading, and no legacy notice', () => {
    const { container } = render(<CanvasWorkspace />)

    expect(container.innerHTML).toBe('')
  })

  // ── Mobile tabs include diagnostics and history ────────────────

  it('renders diagnostics and history tabs on mobile', () => {
    mockIsMobile = true
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    expect(screen.getByTestId('canvas-tab-diagnostics')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-tab-history')).toBeInTheDocument()
  })

  it('switches to diagnostics tab on mobile', () => {
    mockIsMobile = true
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-tab-diagnostics'))

    expect(screen.getByTestId('canvas-diagnostics-slot')).toBeInTheDocument()
  })

  it('switches to history tab on mobile', () => {
    mockIsMobile = true
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasWorkspace />)

    fireEvent.click(screen.getByTestId('canvas-tab-history'))

    expect(screen.getByTestId('canvas-history-slot')).toBeInTheDocument()
  })
})

// ── CanvasEditor tests ──────────────────────────────────────────────

describe('CanvasEditor', () => {
  let CanvasEditor: (typeof import('./canvas-editor'))['CanvasEditor']

  beforeEach(async () => {
    mockIsMobile = false
    resetCanvasState()
    const mod = await import('./canvas-editor')
    CanvasEditor = mod.CanvasEditor
  })

  it('renders file tabs for existing files', () => {
    const artifact = makeArtifact({
      draftSource: {
        'App.tsx': 'export default () => null',
        'styles.css': 'body { color: red }',
        'meta.json': '{"title":"test"}'
      }
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasEditor />)

    expect(screen.getByTestId('canvas-file-tab-App.tsx')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-file-tab-styles.css')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-file-tab-meta.json')).toBeInTheDocument()
  })

  it('switches between file tabs', () => {
    const artifact = makeArtifact({
      draftSource: {
        'App.tsx': 'const App = () => null',
        'styles.css': '.root { color: blue }'
      }
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasEditor />)

    // App.tsx is default — verify content
    expect(screen.getByTestId('canvas-codemirror')).toHaveValue(
      'const App = () => null'
    )

    // Switch to styles.css
    fireEvent.click(screen.getByTestId('canvas-file-tab-styles.css'))

    expect(screen.getByTestId('canvas-codemirror')).toHaveValue(
      '.root { color: blue }'
    )
  })

  it('makes the editor read-only when status is generating', () => {
    const artifact = makeArtifact({ status: 'generating' })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasEditor />)

    const editor = screen.getByTestId('canvas-codemirror')
    expect(editor).toHaveAttribute('aria-readonly', 'true')
  })

  it('makes the editor read-only when status is restoring', () => {
    const artifact = makeArtifact({ status: 'restoring' })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasEditor />)

    const editor = screen.getByTestId('canvas-codemirror')
    expect(editor).toHaveAttribute('aria-readonly', 'true')
  })

  it('does not mark editor read-only when status is ready', () => {
    const artifact = makeArtifact({ status: 'ready' })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasEditor />)

    const editor = screen.getByTestId('canvas-codemirror')
    expect(editor).not.toHaveAttribute('aria-readonly')
  })

  it('shows add-file button for optional files', () => {
    const artifact = makeArtifact({
      draftSource: { 'App.tsx': 'export default () => null' }
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasEditor />)

    expect(screen.getByTestId('canvas-add-file')).toBeInTheDocument()
  })

  it('debounces draft saves on edit', async () => {
    vi.useFakeTimers()

    const mockUpdateDraft = vi
      .fn()
      .mockResolvedValue(makeArtifact({ draftRevision: 2 }))
    const artifact = makeArtifact()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      updateDraft: mockUpdateDraft
    })

    render(<CanvasEditor />)

    const editor = screen.getByTestId('canvas-codemirror')
    fireEvent.change(editor, {
      target: { value: 'const x = 1' }
    })

    // Not called immediately
    expect(mockUpdateDraft).not.toHaveBeenCalled()

    // Advance past debounce and flush microtasks
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(mockUpdateDraft).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('returns null when no artifact loaded', () => {
    setCanvasState({ artifact: null })

    const { container } = render(<CanvasEditor />)

    expect(container.innerHTML).toBe('')
  })
})

// ── CanvasDiagnosticsPanel tests ────────────────────────────────────

describe('CanvasDiagnosticsPanel', () => {
  let CanvasDiagnosticsPanel: (typeof import('./canvas-diagnostics-panel'))['CanvasDiagnosticsPanel']

  beforeEach(async () => {
    resetCanvasState()
    const mod = await import('./canvas-diagnostics-panel')
    CanvasDiagnosticsPanel = mod.CanvasDiagnosticsPanel
  })

  it('shows empty state when no diagnostics', () => {
    const artifact = makeArtifact({ draftDiagnostics: null })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasDiagnosticsPanel />)

    expect(screen.getByTestId('canvas-diagnostics-empty')).toBeInTheDocument()
    expect(screen.getByText('No diagnostics')).toBeInTheDocument()
  })

  it('renders validation diagnostics with severity', () => {
    const diagnostics: CanvasDiagnostics = {
      validation: [
        {
          severity: 'error',
          message: 'Disallowed import: fs',
          file: 'App.tsx',
          line: 3
        }
      ],
      compile: [],
      runtime: [],
      externalDependencies: []
    }
    const artifact = makeArtifact({ draftDiagnostics: diagnostics })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasDiagnosticsPanel />)

    expect(screen.getByTestId('canvas-diagnostics-panel')).toBeInTheDocument()
    expect(
      screen.getByTestId('canvas-diagnostics-section-validation')
    ).toBeInTheDocument()
    expect(screen.getByText('Disallowed import: fs')).toBeInTheDocument()
    expect(screen.getByText('App.tsx')).toBeInTheDocument()
  })

  it('renders compile diagnostics', () => {
    const diagnostics: CanvasDiagnostics = {
      validation: [],
      compile: [
        {
          severity: 'error',
          message: 'Syntax error in App.tsx',
          file: 'App.tsx',
          line: 10
        }
      ],
      runtime: [],
      externalDependencies: []
    }
    const artifact = makeArtifact({ draftDiagnostics: diagnostics })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasDiagnosticsPanel />)

    expect(
      screen.getByTestId('canvas-diagnostics-section-compile')
    ).toBeInTheDocument()
    expect(screen.getByText('Syntax error in App.tsx')).toBeInTheDocument()
  })

  it('renders runtime diagnostics', () => {
    const diagnostics: CanvasDiagnostics = {
      validation: [],
      compile: [],
      runtime: [
        {
          severity: 'warning',
          message: 'Uncaught TypeError: foo is not a function'
        }
      ],
      externalDependencies: []
    }
    const artifact = makeArtifact({ draftDiagnostics: diagnostics })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasDiagnosticsPanel />)

    expect(
      screen.getByTestId('canvas-diagnostics-section-runtime')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Uncaught TypeError: foo is not a function')
    ).toBeInTheDocument()
  })

  it('renders diagnostics with all severity levels', () => {
    const diagnostics: CanvasDiagnostics = {
      validation: [
        { severity: 'error', message: 'Error diagnostic' },
        { severity: 'warning', message: 'Warning diagnostic' },
        { severity: 'info', message: 'Info diagnostic' }
      ],
      compile: [],
      runtime: [],
      externalDependencies: []
    }
    const artifact = makeArtifact({ draftDiagnostics: diagnostics })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasDiagnosticsPanel />)

    expect(screen.getByText('Error diagnostic')).toBeInTheDocument()
    expect(screen.getByText('Warning diagnostic')).toBeInTheDocument()
    expect(screen.getByText('Info diagnostic')).toBeInTheDocument()
  })
})

// ── CanvasVersionHistory tests ──────────────────────────────────────

describe('CanvasVersionHistory', () => {
  let CanvasVersionHistory: (typeof import('./canvas-version-history'))['CanvasVersionHistory']

  beforeEach(async () => {
    resetCanvasState()
    const mod = await import('./canvas-version-history')
    CanvasVersionHistory = mod.CanvasVersionHistory
  })

  it('shows empty state when no versions', () => {
    const artifact = makeArtifact({ versions: [] })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasVersionHistory />)

    expect(screen.getByTestId('canvas-history-empty')).toBeInTheDocument()
    expect(screen.getByText('No saved versions')).toBeInTheDocument()
  })

  it('renders version list newest first', () => {
    const artifact = makeArtifact({
      versions: [
        {
          id: 'v1',
          versionNumber: 1,
          createdBy: 'ai',
          createdAt: '2026-03-18T10:00:00Z'
        },
        {
          id: 'v2',
          versionNumber: 2,
          createdBy: 'user',
          createdAt: '2026-03-18T12:00:00Z'
        }
      ]
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasVersionHistory />)

    expect(screen.getByTestId('canvas-version-v1')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-version-v2')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
  })

  it('shows created-by badges', () => {
    const artifact = makeArtifact({
      versions: [
        {
          id: 'v1',
          versionNumber: 1,
          createdBy: 'ai',
          createdAt: '2026-03-18T10:00:00Z'
        },
        {
          id: 'v2',
          versionNumber: 2,
          createdBy: 'user',
          createdAt: '2026-03-18T12:00:00Z'
        },
        {
          id: 'v3',
          versionNumber: 3,
          createdBy: 'restore',
          createdAt: '2026-03-18T14:00:00Z'
        }
      ]
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasVersionHistory />)

    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    // "Restore" appears both as a createdBy badge and as button text
    // so verify the badge appears within a version item
    const v3 = screen.getByTestId('canvas-version-v3')
    expect(v3.textContent).toContain('Restore')
  })

  it('calls saveVersion when Save version button is clicked', async () => {
    const mockSaveVersion = vi.fn().mockResolvedValue(makeArtifact())
    const artifact = makeArtifact({ status: 'ready' })
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      saveVersion: mockSaveVersion
    })

    render(<CanvasVersionHistory />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('canvas-history-save-version'))
    })

    expect(mockSaveVersion).toHaveBeenCalledTimes(1)
  })

  it('shows restore confirmation when Restore is clicked', () => {
    const artifact = makeArtifact({
      versions: [
        {
          id: 'v1',
          versionNumber: 1,
          createdBy: 'ai',
          createdAt: '2026-03-18T10:00:00Z'
        }
      ]
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasVersionHistory />)

    fireEvent.click(screen.getByTestId('canvas-restore-v1'))

    expect(
      screen.getByTestId('canvas-restore-confirmation')
    ).toBeInTheDocument()
    expect(screen.getByTestId('canvas-restore-confirm')).toBeInTheDocument()
    expect(screen.getByText('Discard draft and restore')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-restore-cancel')).toBeInTheDocument()
    expect(screen.getByText('Cancel restore')).toBeInTheDocument()
  })

  it('calls restoreVersion when confirmation is accepted', async () => {
    const mockRestoreVersion = vi.fn().mockResolvedValue(makeArtifact())
    const artifact = makeArtifact({
      versions: [
        {
          id: 'v1',
          versionNumber: 1,
          createdBy: 'ai',
          createdAt: '2026-03-18T10:00:00Z'
        }
      ]
    })
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      restoreVersion: mockRestoreVersion
    })

    render(<CanvasVersionHistory />)

    // Click restore
    fireEvent.click(screen.getByTestId('canvas-restore-v1'))
    // Confirm restore
    await act(async () => {
      fireEvent.click(screen.getByTestId('canvas-restore-confirm'))
    })

    expect(mockRestoreVersion).toHaveBeenCalledWith('v1')
  })

  it('dismisses restore confirmation on cancel', () => {
    const artifact = makeArtifact({
      versions: [
        {
          id: 'v1',
          versionNumber: 1,
          createdBy: 'ai',
          createdAt: '2026-03-18T10:00:00Z'
        }
      ]
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasVersionHistory />)

    fireEvent.click(screen.getByTestId('canvas-restore-v1'))
    expect(
      screen.getByTestId('canvas-restore-confirmation')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('canvas-restore-cancel'))

    expect(
      screen.queryByTestId('canvas-restore-confirmation')
    ).not.toBeInTheDocument()
  })

  it('shows Export HTML button', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasVersionHistory />)

    expect(screen.getByTestId('canvas-history-export')).toBeInTheDocument()
    expect(screen.getByText('Export HTML')).toBeInTheDocument()
  })

  it('calls exportHtml on Export HTML button click', () => {
    const mockExportHtml = vi.fn()
    const artifact = makeArtifact()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      exportHtml: mockExportHtml
    })

    render(<CanvasVersionHistory />)

    fireEvent.click(screen.getByTestId('canvas-history-export'))

    expect(mockExportHtml).toHaveBeenCalledTimes(1)
  })

  it('disables Export HTML when no compiled HTML', () => {
    const artifact = makeArtifact({ draftCompiledHtml: null })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasVersionHistory />)

    expect(screen.getByTestId('canvas-history-export')).toBeDisabled()
  })

  it('shows external dependencies section when present', () => {
    const artifact = makeArtifact({
      draftDiagnostics: {
        validation: [],
        compile: [],
        runtime: [],
        externalDependencies: [
          {
            type: 'image',
            url: 'https://example.com/pic.png',
            label: 'Hero image'
          },
          {
            type: 'font',
            url: 'https://fonts.googleapis.com/css?family=Roboto'
          }
        ]
      }
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasVersionHistory />)

    expect(
      screen.getByTestId('canvas-external-dependencies')
    ).toBeInTheDocument()
    expect(screen.getByText('External dependencies')).toBeInTheDocument()
    expect(screen.getByText('Hero image')).toBeInTheDocument()
    expect(screen.getAllByTestId('canvas-external-dep')).toHaveLength(2)
  })

  it('does not show external dependencies section when empty', () => {
    const artifact = makeArtifact({
      draftDiagnostics: {
        validation: [],
        compile: [],
        runtime: [],
        externalDependencies: []
      }
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasVersionHistory />)

    expect(
      screen.queryByTestId('canvas-external-dependencies')
    ).not.toBeInTheDocument()
  })

  it('external dependencies appear before Export HTML button', () => {
    const artifact = makeArtifact({
      draftDiagnostics: {
        validation: [],
        compile: [],
        runtime: [],
        externalDependencies: [
          { type: 'api', url: 'https://api.example.com/data' }
        ]
      }
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasVersionHistory />)

    const deps = screen.getByTestId('canvas-external-dependencies')
    const exportBtn = screen.getByTestId('canvas-history-export')

    // Verify deps appears before export in DOM order
    const container = screen.getByTestId('canvas-version-history')
    const children = Array.from(container.children)
    const depsIdx = children.findIndex(el => el.contains(deps))
    const exportIdx = children.findIndex(el => el.contains(exportBtn))

    expect(depsIdx).toBeLessThan(exportIdx)
  })
})

// ── Stale conflict tests ────────────────────────────────────────────

describe('CanvasEditor — stale conflict', () => {
  let CanvasEditor: (typeof import('./canvas-editor'))['CanvasEditor']

  beforeEach(async () => {
    resetCanvasState()
    const mod = await import('./canvas-editor')
    CanvasEditor = mod.CanvasEditor
  })

  it('shows conflict warning with recovery actions on 409', async () => {
    vi.useFakeTimers()

    // updateDraft returns null to simulate 409
    const mockUpdateDraft = vi.fn().mockResolvedValue(null)
    const artifact = makeArtifact()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      updateDraft: mockUpdateDraft
    })

    render(<CanvasEditor />)

    const editor = screen.getByTestId('canvas-codemirror')
    fireEvent.change(editor, {
      target: { value: 'conflict content' }
    })

    // Advance past debounce and flush the async save
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(mockUpdateDraft).toHaveBeenCalled()

    expect(screen.getByTestId('canvas-conflict-warning')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-conflict-reload')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-conflict-copy')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-conflict-ai')).toBeInTheDocument()
    expect(screen.getByText('Reload latest draft')).toBeInTheDocument()
    expect(screen.getByText('Copy local changes')).toBeInTheDocument()
    expect(screen.getByText('Ask AI to reapply changes')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('Reload latest draft calls reloadArtifact', async () => {
    vi.useFakeTimers()

    const mockUpdateDraft = vi.fn().mockResolvedValue(null)
    const mockReloadArtifact = vi.fn().mockResolvedValue(undefined)
    const artifact = makeArtifact()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      updateDraft: mockUpdateDraft,
      reloadArtifact: mockReloadArtifact
    })

    render(<CanvasEditor />)

    fireEvent.change(screen.getByTestId('canvas-codemirror'), {
      target: { value: 'trigger conflict' }
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(screen.getByTestId('canvas-conflict-warning')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('canvas-conflict-reload'))

    expect(mockReloadArtifact).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('Ask AI to reapply changes button is disabled until AI editing is implemented', async () => {
    vi.useFakeTimers()

    const mockUpdateDraft = vi.fn().mockResolvedValue(null)
    const artifact = makeArtifact()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      updateDraft: mockUpdateDraft
    })

    render(<CanvasEditor />)

    fireEvent.change(screen.getByTestId('canvas-codemirror'), {
      target: { value: 'conflict content' }
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(screen.getByTestId('canvas-conflict-warning')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-conflict-ai')).toBeDisabled()

    vi.useRealTimers()
  })
})
