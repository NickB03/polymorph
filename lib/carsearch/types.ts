export type CarsearchBrand = 'ford' | 'volvo' | 'polestar'
export type CarsearchAssist = 'std' | 'verify' | 'no'
export type CarsearchDeal = 'great price' | 'good price' | 'fair price' | null
export type CarsearchLocationType = 'dfw' | 'tx' | 'online'
export type CarsearchSourceSite = 'edmunds' | 'carvana' | 'dealer'
export type CarsearchSavedStatus =
  | 'saved'
  | 'contacted'
  | 'test_drive'
  | 'rejected'
  | 'purchased'
export type CarsearchRefreshStatus = 'running' | 'success' | 'failed'

export type CarsearchSortKey =
  | 'recommended'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'miles-asc'
  | 'range-desc'
  | 'distance-asc'

export type CarsearchListing = {
  vin: string
  brand: CarsearchBrand
  model: string
  modelLabel: string
  year: number
  trim: string
  trimType: string
  awd: boolean
  price: number
  miles: number
  epaRangeMiles: number
  location: string
  distanceMiles: number
  locationType: CarsearchLocationType
  deal: CarsearchDeal
  cpo: boolean
  assist: CarsearchAssist
  lemon: boolean
  topPick: boolean
  topPickReason: string | null
  features: string[]
  imageUrl: string | null
  sourceUrl: string
  sourceSite: CarsearchSourceSite
  listedSince: string | null
  firstSeenAt: string
  lastSeenAt: string
  isActive: boolean
}

export type CarsearchSavedListing = {
  vin: string
  status: CarsearchSavedStatus
  note: string | null
  savedByUserId: string
  savedAt: string
  updatedAt: string
}

export type CarsearchPriceHistory = {
  id: string
  vin: string
  observedAt: string
  price: number
  sourceSite: string
}

export type CarsearchRefreshRun = {
  id: string
  startedAt: string
  completedAt: string | null
  status: CarsearchRefreshStatus
  sourceSite: string
  seenCount: number
  insertedCount: number
  updatedCount: number
  deactivatedCount: number
  error: string | null
}

export type CarsearchFilters = {
  brand: CarsearchBrand | 'all'
  confirmedOnly: boolean
  savedOnly: boolean
  sort: CarsearchSortKey
}
