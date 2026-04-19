'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isAdminUserId } from '@/lib/auth/is-admin'
import { userEvalPreferences } from '@/lib/db/schema'
import { withRLS } from '@/lib/db/with-rls'
import type { TemplateId } from '@/lib/evals/layout/types'

const VALID_LAYOUTS = new Set<TemplateId>(['a', 'b', 'c'])

export async function setPreferredEvalsLayout(
  layout: TemplateId
): Promise<{ success: boolean; error?: string }> {
  if (!VALID_LAYOUTS.has(layout)) {
    return { success: false, error: 'Invalid layout id' }
  }

  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'Unauthenticated' }
  }
  if (!isAdminUserId(user.id)) {
    return { success: false, error: 'Forbidden' }
  }

  try {
    await withRLS(user.id, tx =>
      tx
        .insert(userEvalPreferences)
        .values({ userId: user.id, preferredLayout: layout })
        .onConflictDoUpdate({
          target: userEvalPreferences.userId,
          set: { preferredLayout: layout, updatedAt: new Date() }
        })
    )
  } catch (error) {
    console.error('setPreferredEvalsLayout failed:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to persist layout preference'
    }
  }

  revalidatePath('/admin/evals')
  return { success: true }
}
