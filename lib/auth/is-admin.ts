import { getCurrentUser } from './get-current-user'

function getConfiguredAdminUserId() {
  const adminUserId = process.env.ADMIN_USER_ID?.trim()
  return adminUserId ? adminUserId : null
}

export function isAdminUserId(userId: string | null | undefined) {
  const adminUserId = getConfiguredAdminUserId()
  return Boolean(adminUserId && userId && userId === adminUserId)
}

export async function isCurrentUserAdmin() {
  if (process.env.ENABLE_AUTH === 'false') {
    return false
  }

  const adminUserId = getConfiguredAdminUserId()
  if (!adminUserId) {
    return false
  }

  const user = await getCurrentUser()
  return Boolean(user && user.id === adminUserId)
}
