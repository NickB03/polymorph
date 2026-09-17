import { notFound, redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isAdminUserId } from '@/lib/auth/is-admin'
import { getEvalsDashboard } from '@/lib/evals/queries'

import { EvalsDashboardV2 } from '@/components/evals/dashboard-v2/dashboard'

export const dynamic = 'force-dynamic'

export default async function EvalsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login')
    return null
  }

  // Authorize at the page too — a layout is not an authorization boundary
  if (!isAdminUserId(user.id)) {
    notFound()
    return null
  }

  const data = await getEvalsDashboard(user.id)

  return <EvalsDashboardV2 data={data} />
}
