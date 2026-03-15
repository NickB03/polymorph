import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArtifactToolContext } from '@/lib/artifacts/tool-context'

vi.mock('@/lib/artifacts/runtime', () => ({
  createE2BRuntime: vi.fn()
}))

vi.mock('@/lib/artifacts/templates/read-template', () => ({
  readTemplateFiles: vi.fn()
}))

vi.mock('@/lib/artifacts/validation/validate-artifact-source', () => ({
  validateArtifactSource: vi.fn()
}))

vi.mock('@/lib/artifacts/guest-token', () => ({
  signGuestArtifactToken: vi.fn(),
  refreshGuestArtifactToken: vi.fn(),
  getTtlMs: vi.fn(() => 30 * 60 * 1000)
}))

vi.mock('@/lib/db/actions', () => ({
  createArtifactRecord: vi.fn(),
  updateArtifactRecord: vi.fn(),
  loadArtifactByChatId: vi.fn(),
  loadArtifactRuntimeSession: vi.fn(),
  appendArtifactRevision: vi.fn(),
  upsertArtifactRuntimeSession: vi.fn(),
  ensureChatRecord: vi.fn()
}))

vi.mock('@/lib/artifacts/observability', () => ({
  logArtifactEvent: vi.fn()
}))

import { signGuestArtifactToken } from '@/lib/artifacts/guest-token'
import { createE2BRuntime } from '@/lib/artifacts/runtime'
import { readTemplateFiles } from '@/lib/artifacts/templates/read-template'
import { validateArtifactSource } from '@/lib/artifacts/validation/validate-artifact-source'
import * as dbActions from '@/lib/db/actions'

import {
  orchestrateCreate,
  orchestrateRestart,
  queryArtifactStatus
} from './orchestrate'

function createContext(
  overrides: Partial<ArtifactToolContext> = {}
): ArtifactToolContext {
  return {
    chatId: 'chat-1',
    userId: 'user-1',
    isGuest: false,
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Build a todo app' }]
      }
    ] as any,
    triggeringMessageId: 'msg-1',
    resolveGuestArtifactToken: vi.fn().mockResolvedValue(null),
    emitArtifact: vi.fn(),
    emitArtifactStatus: vi.fn(),
    emitArtifactLog: vi.fn(),
    emitArtifactEvent: vi.fn(),
    ...overrides
  }
}

describe('artifact orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(readTemplateFiles).mockResolvedValue({
      'package.json': '{ "name": "artifact-app" }',
      'src/App.tsx':
        'export default function App() { return <div>Template</div> }'
    })

    vi.mocked(validateArtifactSource).mockReturnValue({
      valid: true,
      errors: [],
      repaired: false
    })

    vi.mocked(createE2BRuntime).mockReturnValue({
      createSession: vi.fn().mockResolvedValue({
        sandboxId: 'sandbox-1',
        sandboxUrl: 'https://sandbox-1.e2b.dev'
      }),
      writeFiles: vi.fn().mockResolvedValue(undefined),
      applySourceUpdate: vi.fn().mockResolvedValue(undefined),
      installDependencies: vi.fn().mockResolvedValue(undefined),
      runCommand: vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: ''
      }),
      startPreview: vi.fn().mockResolvedValue({
        previewUrl: 'https://5173-sandbox-1.e2b.dev',
        status: 'ready'
      }),
      restartPreview: vi.fn().mockResolvedValue({
        previewUrl: 'https://5173-sandbox-1.e2b.dev',
        status: 'ready'
      }),
      getLogs: vi.fn().mockResolvedValue([]),
      destroySession: vi.fn().mockResolvedValue(undefined)
    })

    vi.mocked(dbActions.createArtifactRecord).mockResolvedValue({
      id: 'artifact-1',
      chatId: 'chat-1',
      userId: 'user-1',
      currentRevisionId: null,
      currentRuntimeSessionId: null,
      title: 'Todo App',
      framework: 'react-spa',
      status: 'building',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any)

    vi.mocked(dbActions.upsertArtifactRuntimeSession)
      .mockResolvedValueOnce({
        id: 'runtime-1',
        artifactId: 'artifact-1',
        provider: 'e2b',
        sandboxId: 'sandbox-1',
        previewUrl: null,
        status: 'building',
        startedAt: new Date(),
        expiresAt: null,
        lastHeartbeatAt: null
      } as any)
      .mockResolvedValueOnce({
        id: 'runtime-1',
        artifactId: 'artifact-1',
        provider: 'e2b',
        sandboxId: 'sandbox-1',
        previewUrl: 'https://5173-sandbox-1.e2b.dev',
        status: 'ready',
        startedAt: new Date(),
        expiresAt: null,
        lastHeartbeatAt: null
      } as any)

    vi.mocked(dbActions.appendArtifactRevision).mockResolvedValue({
      id: 'revision-1',
      artifactId: 'artifact-1',
      triggeringMessageId: 'msg-1',
      promptSummary: 'Build a todo app',
      title: 'Todo App',
      sandboxSnapshotRef: null,
      createdAt: new Date()
    } as any)
  })

  it('creates a sandbox-backed artifact and persists runtime + revision state', async () => {
    const ctx = createContext()

    const result = await orchestrateCreate(
      {
        title: 'Todo App',
        description: 'A small task tracker',
        files: {
          'src/App.tsx':
            'export default function App() { return <div>Todo</div> }'
        }
      },
      ctx
    )

    expect(result).toMatchObject({
      success: true,
      action: 'create',
      artifactId: 'artifact-1',
      previewUrl: 'https://5173-sandbox-1.e2b.dev'
    })
    expect(dbActions.createArtifactRecord).toHaveBeenCalled()
    expect(dbActions.appendArtifactRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'artifact-1',
        triggeringMessageId: 'msg-1',
        promptSummary: 'Build a todo app'
      }),
      'user-1'
    )
    expect(ctx.emitArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'artifact-1',
        status: 'ready',
        previewUrl: 'https://5173-sandbox-1.e2b.dev'
      })
    )
    expect(ctx.emitArtifactStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'artifact-1',
        status: 'ready',
        revisionId: 'revision-1'
      })
    )
  })

  it('returns validation errors without creating a sandbox', async () => {
    vi.mocked(validateArtifactSource).mockReturnValueOnce({
      valid: false,
      errors: [
        {
          code: 'BANNED_IMPORT',
          message: 'Import "next/link" is not available in a React SPA artifact'
        }
      ],
      repaired: false
    })

    const ctx = createContext()
    const result = await orchestrateCreate(
      {
        title: 'Broken App',
        description: 'should fail validation',
        files: {
          'src/App.tsx': `import Link from 'next/link'`
        }
      },
      ctx
    )

    expect(result).toEqual({
      success: false,
      action: 'create',
      errors: [
        {
          code: 'BANNED_IMPORT',
          message: 'Import "next/link" is not available in a React SPA artifact'
        }
      ]
    })
    expect(createE2BRuntime).not.toHaveBeenCalled()
  })

  it('issues a guest artifact token in persistent artifact payloads', async () => {
    vi.mocked(signGuestArtifactToken).mockResolvedValue('guest-token-123')

    const ctx = createContext({
      userId: null,
      isGuest: true,
      triggeringMessageId: null
    })

    const result = await orchestrateCreate(
      {
        title: 'Guest App',
        description: 'guest flow',
        files: {
          'src/App.tsx':
            'export default function App() { return <div>Guest</div> }'
        }
      },
      ctx
    )

    expect(result).toMatchObject({
      success: true,
      action: 'create',
      guestArtifactToken: 'guest-token-123'
    })
    expect(ctx.emitArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        guestArtifactToken: 'guest-token-123'
      })
    )
    expect(ctx.emitArtifactStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        guestArtifactToken: 'guest-token-123'
      })
    )
  })

  it('persists failed artifact state when sandbox setup fails', async () => {
    vi.mocked(createE2BRuntime).mockReturnValueOnce({
      createSession: vi.fn().mockRejectedValue(new Error('E2B is down')),
      writeFiles: vi.fn(),
      applySourceUpdate: vi.fn(),
      installDependencies: vi.fn(),
      runCommand: vi.fn(),
      startPreview: vi.fn(),
      restartPreview: vi.fn(),
      getLogs: vi.fn(),
      destroySession: vi.fn()
    } as any)

    const ctx = createContext()
    const result = await orchestrateCreate(
      {
        title: 'Failing App',
        description: 'runtime failure',
        files: {
          'src/App.tsx':
            'export default function App() { return <div>Fail</div> }'
        }
      },
      ctx
    )

    expect(result).toMatchObject({
      success: false,
      action: 'create'
    })
    expect(dbActions.updateArtifactRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'artifact-1',
        status: 'failed'
      }),
      'user-1'
    )
    expect(ctx.emitArtifactStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'artifact-1',
        status: 'failed'
      })
    )
  })

  it('restarts the current runtime session and rotates the guest token', async () => {
    vi.mocked(dbActions.loadArtifactByChatId).mockResolvedValue({
      id: 'artifact-1',
      chatId: 'chat-1',
      userId: null,
      currentRevisionId: null,
      currentRuntimeSessionId: 'runtime-1',
      title: 'Guest App',
      framework: 'react-spa',
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any)
    vi.mocked(dbActions.loadArtifactRuntimeSession).mockResolvedValue({
      id: 'runtime-1',
      artifactId: 'artifact-1',
      provider: 'e2b',
      sandboxId: 'sandbox-1',
      previewUrl: 'https://5173-sandbox-1.e2b.dev',
      status: 'ready',
      startedAt: new Date(),
      expiresAt: null,
      lastHeartbeatAt: null
    } as any)
    vi.mocked(signGuestArtifactToken).mockResolvedValue('rotated-token')

    const ctx = createContext({
      userId: null,
      isGuest: true,
      chatId: 'chat-1',
      resolveGuestArtifactToken: vi.fn().mockResolvedValue({
        artifactId: 'artifact-1',
        runtimeSessionId: 'runtime-1',
        sandboxId: 'sandbox-1',
        chatId: 'chat-1',
        expiresAt: new Date(Date.now() + 30_000)
      })
    })

    const result = await orchestrateRestart({ reason: 'preview stuck' }, ctx)

    expect(result).toMatchObject({
      success: true,
      action: 'restart',
      guestArtifactToken: 'rotated-token'
    })
    expect(dbActions.upsertArtifactRuntimeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'runtime-1',
        artifactId: 'artifact-1',
        status: 'ready'
      }),
      null
    )
  })

  it('emits persistent artifact state during status queries', async () => {
    vi.mocked(dbActions.loadArtifactByChatId).mockResolvedValue({
      id: 'artifact-1',
      chatId: 'chat-1',
      userId: 'user-1',
      currentRevisionId: 'revision-1',
      currentRuntimeSessionId: 'runtime-1',
      title: 'Todo App',
      framework: 'react-spa',
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any)
    vi.mocked(dbActions.loadArtifactRuntimeSession).mockResolvedValue({
      id: 'runtime-1',
      artifactId: 'artifact-1',
      provider: 'e2b',
      sandboxId: 'sandbox-1',
      previewUrl: 'https://5173-sandbox-1.e2b.dev',
      status: 'ready',
      startedAt: new Date(),
      expiresAt: null,
      lastHeartbeatAt: null
    } as any)

    const ctx = createContext()
    const result = await queryArtifactStatus({ reason: 'check' }, ctx)

    expect(result).toMatchObject({
      success: true,
      action: 'status',
      artifactId: 'artifact-1',
      status: 'ready'
    })
    expect(ctx.emitArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'artifact-1',
        title: 'Todo App',
        status: 'ready'
      })
    )
    expect(ctx.emitArtifactStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'artifact-1',
        status: 'ready'
      })
    )
  })
})
