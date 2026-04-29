import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'

import { PolishedEvalsDashboard } from '@/components/evals/demo/polished-dashboard'

export const dynamic = 'force-dynamic'

export default async function EvalsDemoPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login')
    return null
  }

  return <PolishedEvalsDashboard />
}
