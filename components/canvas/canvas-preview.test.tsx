import React from 'react'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assembleCanvasHtml } from '@/lib/canvas/compiler/assemble-canvas-html'
import type { CanvasArtifactState } from '@/lib/canvas/service'
import type { CanvasArtifactStatus } from '@/lib/types/canvas'

import type { CanvasContextValue } from './canvas-context'

// ── Mocks ────────────────────────────────────────────────────────────

const mockCanvasContext: CanvasContextValue = {
  artifactId: null,
  artifact: null,
  isLoading: false,
  isWorkspaceOpen: false,
  guestCanvasToken: null,
  pendingWorkspace: null as any,
  compileProgress: null as any,
  openCanvasArtifact: vi.fn(),
  focusCanvasArtifact: vi.fn(),
  closeWorkspace: vi.fn(),
  requestCanvasAiUpdate: vi.fn(),
  reloadArtifact: vi.fn(),
  setGuestCanvasToken: vi.fn(),
  setPendingWorkspace: vi.fn() as any,
  clearPendingWorkspace: vi.fn() as any,
  setCompileProgress: vi.fn() as any,
  clearCompileProgress: vi.fn() as any,
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

// ── Helpers ──────────────────────────────────────────────────────────

function makeArtifact(
  overrides: Partial<CanvasArtifactState> = {}
): CanvasArtifactState {
  return {
    artifactId: 'art-1',
    chatId: 'chat-1',
    title: 'Test Artifact',
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
    guestCanvasToken: null,
    pendingWorkspace: null,
    compileProgress: null,
    requestCanvasAiUpdate: vi.fn(),
    setArtifact: vi.fn(),
    reloadArtifact: vi.fn(),
    setPendingWorkspace: vi.fn(),
    clearPendingWorkspace: vi.fn(),
    setCompileProgress: vi.fn(),
    clearCompileProgress: vi.fn()
  })
  vi.clearAllMocks()
}

/** Simulate a postMessage from the preview iframe */
function simulatePreviewMessage(
  overrides: Record<string, unknown> = {},
  source?: Window | null
) {
  const defaults = {
    channel: 'canvas-preview',
    type: 'preview-ready',
    artifactId: 'art-1',
    revisionId: '1',
    nonce: 'test-nonce'
  }

  const event = new MessageEvent('message', {
    data: { ...defaults, ...overrides },
    source: source as Window
  })

  window.dispatchEvent(event)
}

// ── Tests ────────────────────────────────────────────────────────────

async function importPreview() {
  const mod = await import('./canvas-preview')
  return mod.CanvasPreview
}

describe('CanvasPreview', () => {
  let CanvasPreview: Awaited<ReturnType<typeof importPreview>>

  beforeEach(async () => {
    resetCanvasState()
    // Mock fetch globally
    vi.stubGlobal('fetch', vi.fn())
    CanvasPreview = await importPreview()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Iframe rendering ────────────────────────────────────────────

  it('renders iframe with srcdoc attribute', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i)
    expect(frame).toHaveAttribute('srcdoc', artifact.draftCompiledHtml)
  })

  it('sandbox is exactly allow-scripts', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i)
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts')
  })

  it('has title "Canvas preview" for accessibility', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    expect(screen.getByTitle('Canvas preview')).toBeInTheDocument()
  })

  it('returns null when no artifact is loaded', () => {
    setCanvasState({ artifact: null })

    const { container } = render(<CanvasPreview />)

    expect(container.innerHTML).toBe('')
  })

  it('renders compile progress for a pending create before artifact persistence', () => {
    setCanvasState({
      pendingWorkspace: {
        artifactId: 'art-pending',
        title: 'Canvas Artifact'
      } as any,
      compileProgress: {
        artifactId: 'art-pending',
        title: 'Canvas Artifact',
        source: 'create',
        startedAt: '2026-03-28T23:00:00.000Z',
        steps: [
          {
            id: 'validate',
            label: 'Validating source',
            status: 'in-progress'
          },
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
          {
            id: 'assemble',
            label: 'Bundling output',
            status: 'pending'
          }
        ]
      } as any
    })

    render(<CanvasPreview />)

    expect(screen.getByText('Validating source')).toBeInTheDocument()
    expect(screen.queryByTitle(/canvas preview/i)).not.toBeInTheDocument()
  })

  it('uses empty string for srcdoc when draftCompiledHtml is null', () => {
    const artifact = makeArtifact({ draftCompiledHtml: null })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i)
    expect(frame).toHaveAttribute('srcdoc', '')
  })

  it('renders compiled preview HTML with the full host bootstrap contract', async () => {
    const compiledHtml = assembleCanvasHtml({
      js: `
window.__CANVAS_REACT__ = { createElement() { return null } }
window.__CANVAS_REACT_DOM__ = { createRoot() { return { render() {} } } }
window.__CANVAS_APP__ = { default: function App() { return null } }
      `,
      css: 'body { margin: 0; }',
      artifactId: 'art-1',
      revisionId: '1',
      nonce: 'compiled-nonce'
    })

    const artifact = makeArtifact({
      artifactId: 'art-1',
      draftRevision: 1,
      draftCompiledHtml: compiledHtml
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i)

    expect(frame).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('preview-ready')
    )
    expect(frame).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('runtime-error')
    )
    expect(frame).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('unhandled-rejection')
    )
    expect(frame).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('asset-error')
    )
    expect(frame).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('external-request-error')
    )
    expect(frame).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('height-change')
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  // ── Compile failure preserves last successful preview ───────────

  it('preserves last successful preview HTML on compile failure', () => {
    // When status is compile_failed, the server preserves draftCompiledHtml
    // from the last successful compile. The component should render it.
    const artifact = makeArtifact({
      status: 'compile_failed',
      draftCompiledHtml: '<html><body>Last good build</body></html>'
    })
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i)
    expect(frame).toHaveAttribute(
      'srcdoc',
      '<html><body>Last good build</body></html>'
    )
  })

  it('renders compile progress as an overlay over the existing preview during update', () => {
    const artifact = makeArtifact({ status: 'compiling' })
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      compileProgress: {
        artifactId: 'art-1',
        title: artifact.title,
        source: 'update',
        startedAt: '2026-03-28T23:00:00.000Z',
        steps: [
          {
            id: 'validate',
            label: 'Validating source',
            status: 'completed'
          },
          {
            id: 'bundle',
            label: 'Building React components',
            status: 'in-progress'
          },
          {
            id: 'tailwind',
            label: 'Compiling Tailwind styles',
            status: 'pending'
          },
          {
            id: 'assemble',
            label: 'Bundling output',
            status: 'pending'
          }
        ]
      } as any
    })

    render(<CanvasPreview />)

    expect(screen.getByTitle(/canvas preview/i)).toBeInTheDocument()
    expect(screen.getByText('Building React components')).toBeInTheDocument()
  })

  it('shows an Ask AI to fix action for failed compile progress', () => {
    const artifact = makeArtifact({ status: 'compile_failed' })
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      compileProgress: {
        artifactId: 'art-1',
        title: artifact.title,
        source: 'update',
        startedAt: '2026-03-28T23:00:00.000Z',
        outcome: 'failed',
        errorMessage: 'Tailwind CSS error',
        steps: [
          {
            id: 'validate',
            label: 'Validating source',
            status: 'completed'
          },
          {
            id: 'bundle',
            label: 'Building React components',
            status: 'completed'
          },
          {
            id: 'tailwind',
            label: 'Compiling Tailwind styles',
            status: 'failed'
          },
          {
            id: 'assemble',
            label: 'Bundling output',
            status: 'pending'
          }
        ]
      } as any
    })

    render(<CanvasPreview />)

    fireEvent.click(screen.getByRole('button', { name: /ask ai to fix/i }))

    expect(mockCanvasContext.requestCanvasAiUpdate).toHaveBeenCalledWith(
      expect.stringContaining('Tailwind CSS error')
    )
  })

  // ── Init message ───────────────────────────────────────────────

  it('sends init message on iframe load with locked envelope fields', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement

    // Mock the contentWindow.postMessage
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })

    // Trigger the load event
    frame.dispatchEvent(new Event('load'))

    expect(mockPostMessage).toHaveBeenCalledTimes(1)

    const [message, targetOrigin] = mockPostMessage.mock.calls[0]
    expect(message).toMatchObject({
      channel: 'canvas-preview',
      type: 'init',
      artifactId: 'art-1',
      revisionId: '1',
      parentOrigin: window.location.origin
    })
    expect(message).toHaveProperty('nonce')
    expect(typeof message.nonce).toBe('string')
    expect(message.nonce.length).toBeGreaterThan(0)
    expect(targetOrigin).toBe('*')
  })

  it('init message contains only allowed envelope fields', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })

    frame.dispatchEvent(new Event('load'))

    const [message] = mockPostMessage.mock.calls[0]
    const allowedKeys = new Set([
      'channel',
      'type',
      'artifactId',
      'revisionId',
      'nonce',
      'parentOrigin',
      'requestId',
      'payload'
    ])
    for (const key of Object.keys(message)) {
      expect(allowedKeys.has(key)).toBe(true)
    }
  })

  // ── host → preview is limited to init ──────────────────────────

  it('host sends only init type to the preview', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })

    frame.dispatchEvent(new Event('load'))

    // Only one message sent, and it is 'init'
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
    expect(mockPostMessage.mock.calls[0][0].type).toBe('init')
  })

  it('includes the parent origin in the init envelope', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })

    frame.dispatchEvent(new Event('load'))

    expect(mockPostMessage.mock.calls[0][0]).toMatchObject({
      parentOrigin: window.location.origin
    })
  })

  // ── preview → host message handling ─────────────────────────────

  it('handles preview-ready message without errors', () => {
    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    // Get the nonce from the init message
    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))
    const nonce = mockPostMessage.mock.calls[0][0].nonce

    // Simulate preview-ready — should not throw or trigger fetch
    simulatePreviewMessage(
      {
        type: 'preview-ready',
        nonce
      },
      frame.contentWindow
    )

    expect(fetch).not.toHaveBeenCalled()
  })

  it('POSTs runtime-error diagnostics to the runtime-diagnostics route', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(
          makeArtifact({
            draftDiagnostics: {
              validation: [],
              compile: [],
              runtime: [{ severity: 'error', message: 'test error' }],
              externalDependencies: []
            }
          })
        )
    })
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact()
    const mockSetArtifact = vi.fn()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      setArtifact: mockSetArtifact
    })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))
    const nonce = mockPostMessage.mock.calls[0][0].nonce

    await act(async () => {
      simulatePreviewMessage(
        {
          type: 'runtime-error',
          nonce,
          payload: {
            message: 'Uncaught TypeError',
            filename: 'App.tsx',
            lineno: 5,
            colno: 10,
            stack: 'Error stack'
          }
        },
        frame.contentWindow
      )
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/canvas-artifacts/art-1/runtime-diagnostics',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      )
    })

    // Verify the body
    const [, fetchOpts] = mockFetch.mock.calls[0]
    const body = JSON.parse(fetchOpts.body)
    expect(body.draftRevision).toBe(1)
    expect(body.diagnostics).toHaveLength(1)
    expect(body.diagnostics[0].severity).toBe('error')
    expect(body.diagnostics[0].message).toBe('Uncaught TypeError')
    expect(body.diagnostics[0].file).toBe('App.tsx')
    expect(body.diagnostics[0].line).toBe(5)
    expect(body.diagnostics[0].column).toBe(10)
  })

  it('POSTs unhandled-rejection diagnostics to the runtime-diagnostics route', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeArtifact())
    })
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      setArtifact: vi.fn()
    })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))
    const nonce = mockPostMessage.mock.calls[0][0].nonce

    await act(async () => {
      simulatePreviewMessage(
        {
          type: 'unhandled-rejection',
          nonce,
          payload: { message: 'Promise rejected', stack: '' }
        },
        frame.contentWindow
      )
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const [, fetchOpts] = mockFetch.mock.calls[0]
    const body = JSON.parse(fetchOpts.body)
    expect(body.diagnostics[0].message).toBe('Promise rejected')
  })

  it('POSTs asset-error diagnostics to the runtime-diagnostics route', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeArtifact())
    })
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      setArtifact: vi.fn()
    })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))
    const nonce = mockPostMessage.mock.calls[0][0].nonce

    await act(async () => {
      simulatePreviewMessage(
        {
          type: 'asset-error',
          nonce,
          payload: {
            tagName: 'img',
            src: 'https://example.com/pic.png',
            message: 'Failed to load img'
          }
        },
        frame.contentWindow
      )
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const [, fetchOpts] = mockFetch.mock.calls[0]
    const body = JSON.parse(fetchOpts.body)
    expect(body.diagnostics[0].message).toBe('Failed to load img')
  })

  it('POSTs external-request-error diagnostics to the runtime-diagnostics route', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeArtifact())
    })
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      setArtifact: vi.fn()
    })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))
    const nonce = mockPostMessage.mock.calls[0][0].nonce

    await act(async () => {
      simulatePreviewMessage(
        {
          type: 'external-request-error',
          nonce,
          payload: {
            url: 'https://api.example.com/data',
            message: 'Fetch failed'
          }
        },
        frame.contentWindow
      )
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const [, fetchOpts] = mockFetch.mock.calls[0]
    const body = JSON.parse(fetchOpts.body)
    expect(body.diagnostics[0].message).toBe('Fetch failed')
  })

  it('reloads artifact state from runtime-diagnostics response', async () => {
    const updatedArtifact = makeArtifact({
      draftDiagnostics: {
        validation: [],
        compile: [],
        runtime: [{ severity: 'error', message: 'Runtime boom' }],
        externalDependencies: []
      }
    })
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(updatedArtifact)
    })
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact()
    const mockSetArtifact = vi.fn()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      setArtifact: mockSetArtifact
    })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))
    const nonce = mockPostMessage.mock.calls[0][0].nonce

    await act(async () => {
      simulatePreviewMessage(
        {
          type: 'runtime-error',
          nonce,
          payload: { message: 'Runtime boom' }
        },
        frame.contentWindow
      )
    })

    await waitFor(() => {
      expect(mockSetArtifact).toHaveBeenCalledWith(updatedArtifact)
    })
  })

  it('includes guestCanvasToken in runtime-diagnostics POST when present', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeArtifact())
    })
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      guestCanvasToken: 'guest-token-abc',
      setArtifact: vi.fn()
    })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))
    const nonce = mockPostMessage.mock.calls[0][0].nonce

    await act(async () => {
      simulatePreviewMessage(
        {
          type: 'runtime-error',
          nonce,
          payload: { message: 'error with guest' }
        },
        frame.contentWindow
      )
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const [, fetchOpts] = mockFetch.mock.calls[0]
    const body = JSON.parse(fetchOpts.body)
    expect(body.guestCanvasToken).toBe('guest-token-abc')
  })

  // ── Message validation ──────────────────────────────────────────
  // Nonce and revisionId are no longer validated by the host — the
  // compiled HTML cannot know the client-generated nonce or the final
  // draftRevision. The event.source + artifactId checks are sufficient.

  it('accepts messages with mismatched nonce from the correct iframe', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeArtifact())
    })
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      setArtifact: vi.fn()
    })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))

    await act(async () => {
      simulatePreviewMessage(
        {
          type: 'runtime-error',
          nonce: 'different-nonce',
          payload: { message: 'should still be processed' }
        },
        frame.contentWindow
      )
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  it('accepts messages with mismatched revision from the correct iframe', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeArtifact())
    })
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact({ draftRevision: 5 })
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      setArtifact: vi.fn()
    })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))

    await act(async () => {
      simulatePreviewMessage(
        {
          type: 'runtime-error',
          revisionId: '999',
          nonce: 'any-nonce',
          payload: { message: 'revision mismatch is ok' }
        },
        frame.contentWindow
      )
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  it('ignores messages with wrong artifactId', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))
    const nonce = mockPostMessage.mock.calls[0][0].nonce

    act(() => {
      simulatePreviewMessage(
        {
          type: 'runtime-error',
          artifactId: 'wrong-artifact',
          nonce,
          payload: { message: 'wrong artifact' }
        },
        frame.contentWindow
      )
    })

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('ignores messages from wrong source', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))
    const nonce = mockPostMessage.mock.calls[0][0].nonce

    // Simulate message from a different source (not the iframe's contentWindow)
    const fakeSource = {} as Window
    act(() => {
      simulatePreviewMessage(
        {
          type: 'runtime-error',
          nonce,
          payload: { message: 'wrong source' }
        },
        fakeSource
      )
    })

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── Non-canvas messages are ignored ────────────────────────────

  it('ignores messages without canvas-preview channel', async () => {
    const mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact()
    setCanvasState({ artifact, artifactId: artifact.artifactId })

    render(<CanvasPreview />)

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { channel: 'other-channel', type: 'runtime-error' }
        })
      )
    })

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── Does not POST when diagnostics fetch fails ─────────────────

  it('silently handles failed runtime-diagnostics POST', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', mockFetch)

    const artifact = makeArtifact()
    const mockSetArtifact = vi.fn()
    setCanvasState({
      artifact,
      artifactId: artifact.artifactId,
      setArtifact: mockSetArtifact
    })

    render(<CanvasPreview />)

    const frame = screen.getByTitle(/canvas preview/i) as HTMLIFrameElement
    const mockPostMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true
    })
    frame.dispatchEvent(new Event('load'))
    const nonce = mockPostMessage.mock.calls[0][0].nonce

    await act(async () => {
      simulatePreviewMessage(
        {
          type: 'runtime-error',
          nonce,
          payload: { message: 'error' }
        },
        frame.contentWindow
      )
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // setArtifact should NOT have been called since the response was not ok
    expect(mockSetArtifact).not.toHaveBeenCalled()
  })
})
