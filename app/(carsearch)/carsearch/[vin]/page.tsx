import { notFound } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { canManageCarsearch } from '@/lib/carsearch/auth'
import {
  getCarsearchListing,
  listCarsearchPriceHistory,
  listCarsearchSavedListingsForManager
} from '@/lib/carsearch/queries'

import { CarsearchCarDetail } from '@/components/carsearch/car-detail'

export const dynamic = 'force-dynamic'

export default async function CarsearchDetailPage(props: {
  params: Promise<{ vin: string }>
}) {
  const { vin } = await props.params
  const [user, listing, priceHistory] = await Promise.all([
    getCurrentUser(),
    getCarsearchListing(vin),
    listCarsearchPriceHistory(vin)
  ])

  if (!listing) notFound()

  const canManage = canManageCarsearch(user?.id)
  const savedListings = await listCarsearchSavedListingsForManager(canManage)
  const saved = savedListings.find(item => item.vin === vin) ?? null

  return (
    <CarsearchCarDetail
      canManage={canManage}
      listing={listing}
      priceHistory={priceHistory}
      saved={saved}
    />
  )
}
