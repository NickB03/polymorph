import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CanvasArtifactStatus,
  CanvasDiagnostics,
  CanvasSourceFiles
} from '@/lib/types/canvas'

// Mock the database module before any imports that use it
vi.mock('@/lib/db', () => {
  const mockTx = {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    query: {},
    transaction: vi.fn()
  }

  return {
    db: {
      ...mockTx,
      transaction: vi.fn(async (cb: any) => cb(mockTx))
    }
  }
})

// Import the mock after setting up the mock
import { db } from '@/lib/db'
// Import the functions under test
import {
  createCanvasArtifact,
  createCanvasArtifactVersion,
  listCanvasArtifactVersions,
  loadCanvasArtifactByChatId,
  loadCanvasArtifactById,
  restoreCanvasArtifactVersion,
  updateCanvasArtifactDraft
} from '@/lib/db/actions'
import type { CanvasArtifact, CanvasArtifactVersion } from '@/lib/db/schema'

// Helper to create a mock artifact row
function mockArtifactRow(
  overrides: Partial<CanvasArtifact> = {}
): CanvasArtifact {
  return {
    id: 'artifact-1',
    chatId: 'chat-1',
    userId: 'user-1',
    title: 'Test Canvas',
    status: 'compiling',
    draftSource: { 'App.tsx': 'export default function App() { return null }' },
    draftCompiledHtml: null,
    draftDiagnostics: null,
    draftRevision: 0,
    currentVersionId: null,
    lastCompiledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

// Helper to create a mock version row
function mockVersionRow(
  overrides: Partial<CanvasArtifactVersion> = {}
): CanvasArtifactVersion {
  return {
    id: 'version-1',
    artifactId: 'artifact-1',
    versionNumber: 1,
    sourceSnapshot: {
      'App.tsx': 'export default function App() { return null }'
    },
    createdBy: 'ai',
    createdAt: new Date(),
    ...overrides
  }
}

// Build a chainable mock that supports .insert().values().returning(), etc.
function chainMock(result: any) {
  const chain: any = {}
  for (const method of [
    'insert',
    'select',
    'update',
    'delete',
    'values',
    'set',
    'from',
    'where',
    'limit',
    'orderBy',
    'returning',
    'onConflictDoNothing'
  ]) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  chain.returning.mockResolvedValue(result)
  chain.limit.mockResolvedValue(result)
  chain.orderBy.mockResolvedValue(result)
  return chain
}

describe('Canvas DB Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createCanvasArtifact', () => {
    it('should create a canvas artifact and return the row', async () => {
      const mockRow = mockArtifactRow()
      const chain = chainMock([mockRow])

      // The function uses withOptionalRLS which, for a non-null userId,
      // calls db.transaction. We need to mock the transaction callback.
      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          insert: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await createCanvasArtifact({
        chatId: 'chat-1',
        userId: 'user-1',
        title: 'Test Canvas',
        draftSource: {
          'App.tsx': 'export default function App() { return null }'
        }
      })

      expect(result).toEqual(mockRow)
    })

    it('should use the provided id when given', async () => {
      const mockRow = mockArtifactRow({ id: 'custom-id' })
      const chain = chainMock([mockRow])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          insert: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await createCanvasArtifact({
        id: 'custom-id',
        chatId: 'chat-1',
        userId: 'user-1',
        title: 'Test Canvas',
        draftSource: { 'App.tsx': 'const App = () => null' }
      })

      expect(result.id).toBe('custom-id')
    })
  })

  describe('loadCanvasArtifactByChatId', () => {
    it('should return the artifact for a given chat ID', async () => {
      const mockRow = mockArtifactRow()
      const chain = chainMock([mockRow])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          select: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await loadCanvasArtifactByChatId('chat-1', 'user-1')

      expect(result).toEqual(mockRow)
    })

    it('should return null when no artifact exists for the chat', async () => {
      const chain = chainMock([])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          select: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await loadCanvasArtifactByChatId(
        'nonexistent-chat',
        'user-1'
      )

      expect(result).toBeNull()
    })
  })

  describe('loadCanvasArtifactById', () => {
    it('should return the artifact by its ID', async () => {
      const mockRow = mockArtifactRow()
      const chain = chainMock([mockRow])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          select: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await loadCanvasArtifactById('artifact-1', 'user-1')

      expect(result).toEqual(mockRow)
    })

    it('should return null when artifact does not exist', async () => {
      const chain = chainMock([])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          select: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await loadCanvasArtifactById('nonexistent', 'user-1')

      expect(result).toBeNull()
    })
  })

  describe('updateCanvasArtifactDraft', () => {
    it('should return updated row on matching revision', async () => {
      const updatedRow = mockArtifactRow({ draftRevision: 1, status: 'ready' })
      const chain = chainMock([updatedRow])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          update: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await updateCanvasArtifactDraft({
        artifactId: 'artifact-1',
        expectedRevision: 0,
        status: 'ready',
        draftSource: {
          'App.tsx': 'export default function App() { return <div/> }'
        },
        userId: 'user-1'
      })

      expect(result).toEqual(updatedRow)
      expect(result!.draftRevision).toBe(1)
    })

    it('should return null when revision is stale (0 rows affected)', async () => {
      const chain = chainMock([])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          update: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await updateCanvasArtifactDraft({
        artifactId: 'artifact-1',
        expectedRevision: 999,
        status: 'compiling',
        draftSource: {
          'App.tsx': 'export default function App() { return null }'
        },
        userId: 'user-1'
      })

      expect(result).toBeNull()
    })

    it('should accept optional fields without error', async () => {
      const updatedRow = mockArtifactRow({ draftRevision: 1 })
      const chain = chainMock([updatedRow])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          update: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      // Only setting status, not draftSource or other optional fields
      const result = await updateCanvasArtifactDraft({
        artifactId: 'artifact-1',
        expectedRevision: 0,
        status: 'compiling',
        userId: 'user-1'
      })

      expect(result).toEqual(updatedRow)
    })
  })

  describe('createCanvasArtifactVersion', () => {
    it('should create an immutable version record', async () => {
      const mockVersion = mockVersionRow()
      const chain = chainMock([mockVersion])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          insert: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await createCanvasArtifactVersion({
        artifactId: 'artifact-1',
        versionNumber: 1,
        sourceSnapshot: {
          'App.tsx': 'export default function App() { return null }'
        },
        createdBy: 'ai',
        userId: 'user-1'
      })

      expect(result).toEqual(mockVersion)
      expect(result.versionNumber).toBe(1)
      expect(result.createdBy).toBe('ai')
    })
  })

  describe('listCanvasArtifactVersions', () => {
    it('should return versions ordered by creation time descending', async () => {
      const v2 = mockVersionRow({
        id: 'version-2',
        versionNumber: 2,
        createdAt: new Date('2026-03-19T12:00:00Z')
      })
      const v1 = mockVersionRow({
        id: 'version-1',
        versionNumber: 1,
        createdAt: new Date('2026-03-19T11:00:00Z')
      })
      const chain = chainMock([v2, v1])
      // Override orderBy to return the result directly
      chain.orderBy.mockResolvedValue([v2, v1])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          select: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await listCanvasArtifactVersions('artifact-1', 'user-1')

      expect(result).toHaveLength(2)
      expect(result[0].versionNumber).toBe(2)
      expect(result[1].versionNumber).toBe(1)
    })

    it('should return empty array when no versions exist', async () => {
      const chain = chainMock([])
      chain.orderBy.mockResolvedValue([])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          select: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await listCanvasArtifactVersions('artifact-1', 'user-1')

      expect(result).toEqual([])
    })
  })

  describe('restoreCanvasArtifactVersion', () => {
    it('should restore a version to the active draft', async () => {
      const versionSource = {
        'App.tsx': 'export default function App() { return <p>v1</p> }'
      }
      const mockVersion = mockVersionRow({
        sourceSnapshot: versionSource
      })
      const restoredArtifact = mockArtifactRow({
        draftSource: versionSource,
        draftRevision: 1,
        status: 'restoring',
        draftCompiledHtml: null,
        draftDiagnostics: null
      })

      const selectChain = chainMock([mockVersion])
      const updateChain = chainMock([restoredArtifact])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          select: () => selectChain,
          update: () => updateChain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await restoreCanvasArtifactVersion({
        artifactId: 'artifact-1',
        versionId: 'version-1',
        expectedRevision: 0,
        userId: 'user-1'
      })

      expect(result).toEqual(restoredArtifact)
      expect(result!.status).toBe('restoring')
      expect(result!.draftCompiledHtml).toBeNull()
    })

    it('should return null when version does not exist', async () => {
      const selectChain = chainMock([])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          select: () => selectChain,
          update: vi.fn(),
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await restoreCanvasArtifactVersion({
        artifactId: 'artifact-1',
        versionId: 'nonexistent',
        expectedRevision: 0,
        userId: 'user-1'
      })

      expect(result).toBeNull()
    })

    it('should return null when draft revision is stale', async () => {
      const mockVersion = mockVersionRow()
      const selectChain = chainMock([mockVersion])
      const updateChain = chainMock([])

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          select: () => selectChain,
          update: () => updateChain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      const result = await restoreCanvasArtifactVersion({
        artifactId: 'artifact-1',
        versionId: 'version-1',
        expectedRevision: 999,
        userId: 'user-1'
      })

      expect(result).toBeNull()
    })
  })

  describe('one-artifact-per-chat uniqueness', () => {
    it('should enforce unique chatId at the schema level', async () => {
      // The unique index on chatId is enforced at the DB level.
      // This test verifies the action propagates DB constraint errors.
      const error = new Error(
        'duplicate key value violates unique constraint "canvas_artifacts_chat_id_idx"'
      )

      vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
        const chain = chainMock([])
        chain.returning.mockRejectedValue(error)
        const tx = {
          insert: () => chain,
          execute: vi.fn()
        }
        return cb(tx)
      })

      await expect(
        createCanvasArtifact({
          chatId: 'chat-1',
          userId: 'user-1',
          title: 'Duplicate',
          draftSource: { 'App.tsx': '' }
        })
      ).rejects.toThrow('unique constraint')
    })
  })
})
