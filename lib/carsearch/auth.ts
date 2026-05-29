export function getAllowedCarsearchUserIds() {
  const configured = process.env.CARSEARCH_ALLOWED_USER_IDS?.split(',')
    .map(id => id.trim())
    .filter(Boolean)

  if (configured?.length) return new Set(configured)

  return new Set(
    [process.env.ADMIN_USER_ID].filter((id): id is string => Boolean(id))
  )
}

export function canManageCarsearch(userId: string | null | undefined) {
  if (!userId) return false
  return getAllowedCarsearchUserIds().has(userId)
}
