/**
 * Sentinel user ID for guest-created records (artifacts, ephemeral chats).
 * Used to satisfy the NOT NULL constraint on chats.userId when no real
 * authenticated user is available.
 */
export const GUEST_USER_ID = 'guest'
