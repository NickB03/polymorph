const LOCALHOST_ORIGIN = 'http://localhost:43100'

export function getPublicOrigin(): URL {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL

  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin)
    } catch {
      throw new Error(
        `NEXT_PUBLIC_APP_URL must be a valid absolute URL, received: ${configuredOrigin}`
      )
    }
  }

  const isProductionTarget =
    process.env.VERCEL_ENV === 'production' ||
    process.env.VERCEL_TARGET_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV)

  if (isProductionTarget) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is required for production deployments to generate correct metadata URLs.'
    )
  }

  return new URL(LOCALHOST_ORIGIN)
}
