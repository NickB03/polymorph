'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { Download, X } from 'lucide-react'

import { toProxyFileUrl } from '@/lib/supabase/file-url'

import { Button } from '@/components/ui/button'

import type { GenerateImageProps } from './schema'

export function GenerateImage({
  imageUrl: rawImageUrl,
  filename,
  description
}: GenerateImageProps) {
  // Older tool outputs persisted absolute public storage URLs; the bucket is
  // now private, so those must go through the auth-checked proxy route.
  const imageUrl = toProxyFileUrl(rawImageUrl)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [expanded])

  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        const res = await fetch(imageUrl)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch {
        window.open(imageUrl, '_blank')
      }
    },
    [imageUrl, filename]
  )

  return (
    <>
      <figure className="group relative my-3 w-fit max-w-full overflow-hidden rounded-xl">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="block cursor-zoom-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic external URL */}
          <img
            src={imageUrl}
            alt={description}
            className="max-h-[min(300px,40vh)] w-auto max-w-full rounded-xl object-contain"
            loading="lazy"
          />
        </button>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end rounded-b-xl bg-gradient-to-t from-black/40 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="pointer-events-auto size-7 text-white/80 hover:bg-white/15 hover:text-white"
            onClick={handleDownload}
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      </figure>

      {expanded &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8"
            onClick={() => setExpanded(false)}
            role="dialog"
            aria-modal="true"
            aria-label={description}
          >
            <div className="absolute right-3 top-3 flex items-center gap-1 sm:right-4 sm:top-4 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-white hover:bg-white/10 sm:size-9"
                onClick={handleDownload}
              >
                <Download className="size-4 sm:size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-white hover:bg-white/10 sm:size-9"
                onClick={() => setExpanded(false)}
              >
                <X className="size-4 sm:size-5" />
              </Button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- lightbox, dynamic URL */}
            <img
              src={imageUrl}
              alt={description}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
              onClick={e => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  )
}
