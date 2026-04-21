'use client'

import { memo, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

import { cn } from '@/lib/utils'

import type { GeoMapProps, GeoMapStyle } from './schema'

import styles from './geo-map-theme.module.css'

// The registry can be imported during RSC render, so keep Leaflet behind a
// client-only dynamic boundary instead of importing the engine eagerly.
const GeoMapEngine = dynamic(
  () => import('./geo-map-engine').then(module => module.GeoMapEngine),
  { ssr: false }
)

// MapTiler Streets v2 when the key is configured; CARTO Voyager fallback keeps the map functional for anyone without it.
const MAPTILER_API_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY

const CARTO_VOYAGER_URL =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

const LIGHT_TILE_URL = MAPTILER_API_KEY
  ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}{r}.png?key=${MAPTILER_API_KEY}`
  : CARTO_VOYAGER_URL

const DARK_TILE_URL = MAPTILER_API_KEY
  ? `https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}{r}.png?key=${MAPTILER_API_KEY}`
  : CARTO_VOYAGER_URL

const TILE_ATTRIBUTION = MAPTILER_API_KEY
  ? '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">&copy; OpenStreetMap contributors</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getDocumentTheme(): 'light' | 'dark' | null {
  if (typeof document === 'undefined') return null

  const root = document.documentElement
  const dataTheme = root.getAttribute('data-theme')?.toLowerCase()
  if (dataTheme === 'dark') return 'dark'
  if (dataTheme === 'light') return 'light'
  if (root.classList.contains('dark')) return 'dark'
  if (root.classList.contains('light')) return 'light'

  return null
}

function useInheritedTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const update = () => setTheme(getDocumentTheme() ?? getSystemTheme())

    update()

    const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
    mql?.addEventListener('change', update)

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    })

    return () => {
      mql?.removeEventListener('change', update)
      observer.disconnect()
    }
  }, [])

  return theme
}

function resolveMapAriaLabel(title?: string, description?: string): string {
  if (title && description) {
    return `${title}. ${description}`
  }

  return title ?? description ?? 'Geographic map'
}

export const GeoMap = memo(function GeoMap({
  id,
  role: _role,
  receipt: _receipt,
  title,
  description,
  markers,
  routes,
  clustering,
  viewport,
  showZoomControl = true,
  theme,
  className,
  style,
  tooltipClassName,
  popupClassName,
  onMarkerClick,
  onRouteClick
}: GeoMapProps) {
  const inheritedTheme = useInheritedTheme()
  const resolvedTheme = theme ?? inheritedTheme
  const [isMapReady, setIsMapReady] = useState(false)
  const tileUrl = resolvedTheme === 'dark' ? DARK_TILE_URL : LIGHT_TILE_URL
  const mapAriaLabel = resolveMapAriaLabel(title, description)
  const resolvedRootStyle: GeoMapStyle = {
    '--geo-map-canvas-bg':
      resolvedTheme === 'dark' ? 'var(--background)' : 'var(--muted)',
    ...style
  }

  return (
    <div
      className={cn('w-full min-w-0 sm:min-w-80', styles.root, className)}
      style={resolvedRootStyle}
      data-slot="geo-map"
      data-tool-ui-id={id}
    >
      <div
        className={cn(
          'bg-muted/20 relative w-full overflow-hidden rounded-lg border',
          styles.canvas
        )}
        role="region"
        aria-label={mapAriaLabel}
      >
        <GeoMapEngine
          id={id}
          markers={markers}
          routes={routes}
          clustering={clustering}
          viewport={viewport}
          showZoomControl={showZoomControl}
          tileUrl={tileUrl}
          tileAttribution={TILE_ATTRIBUTION}
          mapAriaLabel={mapAriaLabel}
          tooltipClassName={tooltipClassName}
          popupClassName={popupClassName}
          onMarkerClick={onMarkerClick}
          onRouteClick={onRouteClick}
          onReadyChange={setIsMapReady}
        />

        {(title || description) && (
          <div
            className={cn(
              'pointer-events-none absolute top-3 left-3 z-[900]',
              'max-w-[min(75%,22rem)] rounded-lg border border-border/70 bg-background/70 px-3 py-2',
              'shadow-sm backdrop-blur-md'
            )}
          >
            {title && (
              <p className="text-foreground text-sm leading-tight font-semibold">
                {title}
              </p>
            )}
            {description && (
              <p className="text-muted-foreground mt-1 text-xs leading-snug">
                {description}
              </p>
            )}
          </div>
        )}

        {!isMapReady && (
          <div
            data-slot="geo-map-loading"
            className="bg-muted/30 text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span data-slot="geo-map-loading-label">Loading map...</span>
          </div>
        )}
      </div>
    </div>
  )
})
