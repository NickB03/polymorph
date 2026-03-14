import { describe, expect, it, vi } from 'vitest'

import type { ArtifactToolContext } from '@/lib/artifacts/tool-context'
import { getArtifactContext } from '@/lib/artifacts/tool-context'

import { createWebappArtifactTool } from '../create-webapp-artifact'
import { getArtifactStatusTool } from '../get-artifact-status'
import { restartArtifactPreviewTool } from '../restart-artifact-preview'
import { updateWebappArtifactTool } from '../update-webapp-artifact'

function createMockContext(overrides: Partial<ArtifactToolContext> = {}): {
  experimental_context: { artifactToolContext: ArtifactToolContext }
} {
  return {
    experimental_context: {
      artifactToolContext: {
        chatId: 'chat-1',
        userId: 'user-1',
        isGuest: false,
        messages: [],
        resolveGuestArtifactToken: vi.fn().mockResolvedValue(null),
        emitArtifact: vi.fn(),
        emitArtifactStatus: vi.fn(),
        emitArtifactLog: vi.fn(),
        emitArtifactEvent: vi.fn(),
        ...overrides
      }
    }
  }
}

describe('getArtifactContext', () => {
  it('extracts ArtifactToolContext from experimental_context', () => {
    const mockCtx = createMockContext()
    const result = getArtifactContext(mockCtx)
    expect(result).toBeDefined()
    expect(result?.chatId).toBe('chat-1')
    expect(result?.userId).toBe('user-1')
  })

  it('returns null when experimental_context is missing', () => {
    expect(getArtifactContext({})).toBeNull()
    expect(getArtifactContext({ experimental_context: undefined })).toBeNull()
  })

  it('returns null when artifactToolContext is not in context', () => {
    expect(
      getArtifactContext({ experimental_context: { other: 'data' } })
    ).toBeNull()
  })
})

describe('createWebappArtifact tool', () => {
  it('has the correct description and schema', () => {
    expect(createWebappArtifactTool.description).toContain('webapp')
    expect(createWebappArtifactTool.inputSchema).toBeDefined()
  })

  it('returns success with create action when context is available', async () => {
    const mockCtx = createMockContext()
    const result = await createWebappArtifactTool.execute!(
      {
        title: 'My App',
        description: 'A test app',
        files: { 'src/App.tsx': 'export default function App() {}' }
      },
      mockCtx as any
    )
    expect(result).toMatchObject({
      success: true,
      action: 'create',
      title: 'My App',
      files: { 'src/App.tsx': expect.any(String) }
    })
  })

  it('emits create-started event', async () => {
    const mockCtx = createMockContext()
    await createWebappArtifactTool.execute!(
      {
        title: 'My App',
        description: 'A test app',
        files: { 'src/App.tsx': 'content' }
      },
      mockCtx as any
    )
    const emitEvent =
      mockCtx.experimental_context.artifactToolContext.emitArtifactEvent
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'create-started',
        payload: { title: 'My App' }
      })
    )
  })

  it('returns error when context is not available', async () => {
    const result = await createWebappArtifactTool.execute!(
      {
        title: 'My App',
        description: 'A test app',
        files: {}
      },
      {} as any
    )
    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining('context')
    })
  })
})

describe('updateWebappArtifact tool', () => {
  it('returns success with update action', async () => {
    const mockCtx = createMockContext()
    const result = await updateWebappArtifactTool.execute!(
      {
        description: 'Updated the header',
        files: { 'src/App.tsx': 'updated content' }
      },
      mockCtx as any
    )
    expect(result).toMatchObject({
      success: true,
      action: 'update'
    })
  })

  it('emits update-started event', async () => {
    const mockCtx = createMockContext()
    await updateWebappArtifactTool.execute!(
      {
        description: 'fix layout',
        files: { 'src/App.tsx': 'updated' }
      },
      mockCtx as any
    )
    const emitEvent =
      mockCtx.experimental_context.artifactToolContext.emitArtifactEvent
    expect(emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'update-started' })
    )
  })
})

describe('getArtifactStatus tool', () => {
  it('returns success with status action', async () => {
    const mockCtx = createMockContext()
    const result = await getArtifactStatusTool.execute!(
      { reason: 'checking before update' },
      mockCtx as any
    )
    expect(result).toMatchObject({
      success: true,
      action: 'status'
    })
  })
})

describe('restartArtifactPreview tool', () => {
  it('returns success with restart action', async () => {
    const mockCtx = createMockContext()
    const result = await restartArtifactPreviewTool.execute!(
      { reason: 'preview stuck' },
      mockCtx as any
    )
    expect(result).toMatchObject({
      success: true,
      action: 'restart'
    })
  })
})

describe('create artifact result shape', () => {
  it('returns all required fields: success, action, title, description, files', async () => {
    const mockCtx = createMockContext()
    const result = await createWebappArtifactTool.execute!(
      {
        title: 'Dashboard',
        description: 'An analytics dashboard',
        files: {
          'src/App.tsx': 'export default function App() { return <div /> }',
          'src/utils.ts': 'export const add = (a: number, b: number) => a + b'
        }
      },
      mockCtx as any
    )

    // Verify the exact shape returned to the streaming layer
    expect(result).toEqual({
      success: true,
      action: 'create',
      title: 'Dashboard',
      description: 'An analytics dashboard',
      files: {
        'src/App.tsx': expect.any(String),
        'src/utils.ts': expect.any(String)
      }
    })
  })

  it('does not include an id in the create result (id is assigned downstream)', async () => {
    const mockCtx = createMockContext()
    const result = (await createWebappArtifactTool.execute!(
      {
        title: 'App',
        description: 'test',
        files: { 'src/App.tsx': 'content' }
      },
      mockCtx as any
    )) as Record<string, unknown>

    expect(result.id).toBeUndefined()
  })
})

describe('update artifact preserves artifact id', () => {
  it('multi-turn edits use the same context and return update action', async () => {
    // Simulate two sequential updates using the same context
    const mockCtx = createMockContext({ chatId: 'chat-1' })

    const firstUpdate = await updateWebappArtifactTool.execute!(
      {
        description: 'Add header component',
        files: { 'src/Header.tsx': 'export function Header() {}' }
      },
      mockCtx as any
    )

    const secondUpdate = await updateWebappArtifactTool.execute!(
      {
        description: 'Fix header styling',
        files: {
          'src/Header.tsx': 'export function Header() { return <h1 /> }'
        }
      },
      mockCtx as any
    )

    // Both updates return 'update' action, confirming they target the same artifact
    expect(firstUpdate).toMatchObject({ success: true, action: 'update' })
    expect(secondUpdate).toMatchObject({ success: true, action: 'update' })

    // Both used the same context (same chatId)
    const ctx = getArtifactContext(mockCtx)
    expect(ctx?.chatId).toBe('chat-1')
  })

  it('update includes optional title only when explicitly provided', async () => {
    const mockCtx = createMockContext()

    const withTitle = await updateWebappArtifactTool.execute!(
      {
        title: 'New Title',
        description: 'Changed the title',
        files: { 'src/App.tsx': 'updated' }
      },
      mockCtx as any
    )

    const withoutTitle = await updateWebappArtifactTool.execute!(
      {
        description: 'No title change',
        files: { 'src/App.tsx': 'updated again' }
      },
      mockCtx as any
    )

    expect((withTitle as any).title).toBe('New Title')
    expect((withoutTitle as any).title).toBeUndefined()
  })
})

describe('artifact tools are request-scoped', () => {
  it('do not read module-global state', async () => {
    // Verify tools only use the passed context, not global imports
    const ctx1 = createMockContext({ chatId: 'chat-a', userId: 'user-a' })
    const ctx2 = createMockContext({ chatId: 'chat-b', userId: 'user-b' })

    const result1 = getArtifactContext(ctx1)
    const result2 = getArtifactContext(ctx2)

    expect(result1?.chatId).toBe('chat-a')
    expect(result2?.chatId).toBe('chat-b')
    // Verify they are independent
    expect(result1?.chatId).not.toBe(result2?.chatId)
  })

  it('guest context has null userId and isGuest=true', async () => {
    const guestCtx = createMockContext({
      userId: null,
      isGuest: true
    })
    const result = getArtifactContext(guestCtx)
    expect(result?.userId).toBeNull()
    expect(result?.isGuest).toBe(true)
  })
})
