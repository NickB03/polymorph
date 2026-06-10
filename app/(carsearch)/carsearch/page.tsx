import { getCurrentUser } from '@/lib/auth/get-current-user'
import { canManageCarsearch } from '@/lib/carsearch/auth'
import {
  getLatestCarsearchRefreshRun,
  listActiveCarsearchListings,
  listCarsearchSavedListingsForManager
} from '@/lib/carsearch/queries'

import { CarsearchBrowseShell } from '@/components/carsearch/browse-shell'

export const dynamic = 'force-dynamic'

export default async function CarsearchPage() {
  const [user, listings, refreshRun] = await Promise.all([
    getCurrentUser(),
    listActiveCarsearchListings(),
    getLatestCarsearchRefreshRun()
  ])
  const canManage = canManageCarsearch(user?.id)
  const savedListings = await listCarsearchSavedListingsForManager(canManage)

  return (
    <CarsearchBrowseShell
      listings={listings}
      savedListings={savedListings}
      canManage={canManage}
      refreshRun={refreshRun}
    />
  )
}
