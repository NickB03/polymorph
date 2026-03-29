import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasArtifactState } from '@/lib/canvas/service'

import { CanvasProvider, useCanvas } from './canvas-context'

function makeArtifactState(
  overrides: Partial<CanvasArtifactState> = {}
): CanvasArtifactState {
  return {
    artifactId: 'art-1',
    chatId: 'chat-1',
    title: 'Canvas',
    status: 'ready',
    draftRevision: 1,
    draftSource: {
      'App.tsx': 'export default function App() { return <div>Hello</div> }'
    },
    draftCompiledHtml: '<html><body>Hello</body></html>',
    draftDiagnostics: null,
    currentVersionId: null,
    versions: [],
    updatedAt: '2026-03-19T00:00:00.000Z',
    ...overrides
  }
}

function Harness() {
  const canvas = useCanvas() as any

  return (
    <div>
      <button onClick={() => void canvas.openCanvasArtifact('art-1')}>
        open-auth
      </button>
      <button onClick={() => void canvas.openCanvasArtifact('art-2')}>
        open-next
      </button>
      <button
        onClick={() =>
          void (canvas.openCanvasArtifact as any)('art-1', 'guest-token-abc')
        }
      >
        open-guest
      </button>
      <button onClick={() => canvas.focusCanvasArtifact('art-1')}>focus</button>
      <button
        onClick={() =>
          canvas.setPendingWorkspace({
            artifactId: 'art-pending',
            title: 'Pending Canvas'
          })
        }
      >
        pending
      </button>
      <div data-testid="artifact-id">{canvas.artifact?.artifactId ?? ''}</div>
      <div data-testid="pending-id">
        {canvas.pendingWorkspace?.artifactId ?? ''}
      </div>
      <div data-testid="workspace-open">{String(canvas.isWorkspaceOpen)}</div>
    </div>
  )
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

describe('CanvasProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads authenticated artifacts without a guest token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeArtifactState()
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <CanvasProvider>
        <Harness />
      </CanvasProvider>
    )

    fireEvent.click(screen.getByText('open-auth'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/canvas-artifacts/art-1')
    })
  })

  it('uses the provided guest token on the first artifact fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeArtifactState()
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <CanvasProvider>
        <Harness />
      </CanvasProvider>
    )

    fireEvent.click(screen.getByText('open-guest'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/canvas-artifacts/art-1?guestCanvasToken=guest-token-abc'
      )
    })
  })

  it('focuses an already-loaded artifact without re-fetching it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeArtifactState()
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <CanvasProvider>
        <Harness />
      </CanvasProvider>
    )

    fireEvent.click(screen.getByText('open-auth'))

    await waitFor(() => {
      expect(screen.getByTestId('artifact-id')).toHaveTextContent('art-1')
    })

    fireEvent.click(screen.getByText('focus'))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('clears stale artifact state when opening a different artifact', async () => {
    const firstFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => makeArtifactState({ artifactId: 'art-1' })
    })
    const deferred = createDeferred<Response>()
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(firstFetch)
      .mockImplementationOnce(() => deferred.promise)
    vi.stubGlobal('fetch', fetchMock)

    render(
      <CanvasProvider>
        <Harness />
      </CanvasProvider>
    )

    fireEvent.click(screen.getByText('open-auth'))

    await waitFor(() => {
      expect(screen.getByTestId('artifact-id')).toHaveTextContent('art-1')
    })

    fireEvent.click(screen.getByText('open-next'))

    await waitFor(() => {
      expect(screen.getByTestId('artifact-id')).toHaveTextContent('')
    })
  })

  it('treats a pending workspace as open before artifact persistence', async () => {
    render(
      <CanvasProvider>
        <Harness />
      </CanvasProvider>
    )

    expect(screen.getByTestId('workspace-open')).toHaveTextContent('false')

    fireEvent.click(screen.getByText('pending'))

    await waitFor(() => {
      expect(screen.getByTestId('workspace-open')).toHaveTextContent('true')
    })
  })

  it('replaces stale artifact state when a pending workspace is opened', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeArtifactState()
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <CanvasProvider>
        <Harness />
      </CanvasProvider>
    )

    fireEvent.click(screen.getByText('open-auth'))

    await waitFor(() => {
      expect(screen.getByTestId('artifact-id')).toHaveTextContent('art-1')
    })

    fireEvent.click(screen.getByText('pending'))

    await waitFor(() => {
      expect(screen.getByTestId('artifact-id')).toHaveTextContent('')
      expect(screen.getByTestId('pending-id')).toHaveTextContent('art-pending')
    })
  })
})
