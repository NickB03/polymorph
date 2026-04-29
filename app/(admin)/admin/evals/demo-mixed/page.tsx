import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'

import { MixedEvalsDashboard } from '@/components/evals/demo/mixed-dashboard'

export const dynamic = 'force-dynamic'

export default async function EvalsDemoMixedPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login')
    return null
  }

  return <MixedEvalsDashboard />
}
