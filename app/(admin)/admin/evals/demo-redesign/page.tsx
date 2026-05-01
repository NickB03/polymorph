import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'

import { RedesignEvalsDashboard } from '@/components/evals/demo/redesign-dashboard'

export const dynamic = 'force-dynamic'

export default async function EvalsDemoRedesignPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login')
    return null
  }

  return <RedesignEvalsDashboard />
}
