import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Polymorph',
    short_name: 'Polymorph',
    description:
      'An AI platform with a generative UI for research, creation, and exploration.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      // TODO: Create a proper 512x512 square Polymorph icon
      {
        src: '/images/polymorph_pm_symbol_light_hero_256h.png',
        sizes: '256x256',
        type: 'image/png'
      }
    ]
  }
}
