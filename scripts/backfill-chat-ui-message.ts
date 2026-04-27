import { asc, eq, isNull } from 'drizzle-orm'

import { messages, parts } from '@/lib/db/schema'
import { withOptionalRLS } from '@/lib/db/with-rls'
import type { UIMessage, UIMessageMetadata } from '@/lib/types/ai'
import type { DBMessagePartSelect } from '@/lib/types/message-persistence'
import { buildUIMessageFromDB } from '@/lib/utils/message-mapping'

type BackfillRow = {
  id: string
  role: string
  metadata?: unknown
  createdAt?: Date | string
  parts: DBMessagePartSelect[]
}

export type BackfillChatUiMessagesResult = {
  dryRun: boolean
  scanned: number
  updated: number
}

export function buildBackfilledUIMessage(row: BackfillRow): UIMessage {
  return buildUIMessageFromDB(
    {
      id: row.id,
      role: row.role,
      uiMessage: null,
      metadata: row.metadata as UIMessageMetadata | null,
      createdAt: row.createdAt
    },
    row.parts
  )
}

export async function backfillChatUiMessages({
  dryRun = true,
  limit = 500
}: {
  dryRun?: boolean
  limit?: number
} = {}): Promise<BackfillChatUiMessagesResult> {
  return withOptionalRLS(null, async tx => {
    const rows = await tx.query.messages.findMany({
      where: isNull(messages.uiMessage),
      with: {
        parts: {
          orderBy: [asc(parts.order)]
        }
      },
      orderBy: [asc(messages.createdAt)],
      limit
    })

    let updated = 0

    for (const row of rows) {
      const uiMessage = buildBackfilledUIMessage({
        id: row.id,
        role: row.role,
        metadata: row.metadata,
        createdAt: row.createdAt,
        parts: row.parts ?? []
      })

      if (!dryRun) {
        await tx
          .update(messages)
          .set({
            uiMessage,
            updatedAt: new Date()
          })
          .where(eq(messages.id, row.id))
        updated += 1
      }
    }

    return {
      dryRun,
      scanned: rows.length,
      updated
    }
  })
}
