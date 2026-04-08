'use client'

import { useCallback, useEffect, useState } from 'react'

import { Download, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { GenerateImageProps } from './schema'

export function GenerateImage({
  imageUrl,
  filename,
  description,
  aspectRatio
}: GenerateImageProps) {
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
      <figure className="group relative my-3 w-fit max-w-full overflow-hidden rounded-xl border border-border/50 bg-muted/30">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="block cursor-zoom-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic external URL */}
          <img
            src={imageUrl}
            alt={description}
            className="max-h-[200px] w-auto max-w-full rounded-t-xl object-contain"
            loading="lazy"
          />
        </button>
        <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span className="line-clamp-1">{description}</span>
          <div className="flex shrink-0 items-center gap-1">
            {aspectRatio && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {aspectRatio}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={handleDownload}
            >
              <Download className="size-3" />
            </Button>
          </div>
        </figcaption>
      </figure>

      {expanded && (
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
        </div>
      )}
    </>
  )
}
