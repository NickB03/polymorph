import { notFound, redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isAdminUserId } from '@/lib/auth/is-admin'
import { getCapabilityDashboard } from '@/lib/evals/queries'

import EvalsDashboard from '@/components/evals/dashboard'

export const dynamic = 'force-dynamic'

export default async function EvalsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login')
    return null
  }

  if (!isAdminUserId(user.id)) {
    notFound()
    return null
  }

  const data = await getCapabilityDashboard(user.id)

  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-8 pt-20 sm:px-6 lg:px-8">
        <EvalsDashboard data={data} />
      </div>
    </div>
  )
}
