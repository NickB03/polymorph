import type { Metadata } from 'next'

import { getPublicOrigin } from '@/lib/utils/public-origin'

const title = 'polymorph'
const description =
  'An AI platform with a generative UI for research, creation, and exploration.'

export function createAppMetadata(): Metadata {
  const publicOrigin = getPublicOrigin()
  const socialImage = new URL('/opengraph-image.png', publicOrigin).toString()

  return {
    metadataBase: publicOrigin,
    title,
    description,
    openGraph: {
      title,
      description,
      images: [socialImage]
    },
    twitter: {
      title,
      description,
      card: 'summary_large_image',
      images: [socialImage]
    }
  }
}
