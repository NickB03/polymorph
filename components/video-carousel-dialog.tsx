'use client'

import { useEffect, useRef, useState } from 'react'

import { SerperSearchResultItem } from '@/lib/types'

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from '@/components/ui/carousel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

interface VideoCarouselDialogProps {
  children: React.ReactNode
  videos: SerperSearchResultItem[]
  query: string
  initialIndex?: number // Add initialIndex prop
}

export function VideoCarouselDialog({
  children,
  videos,
  query,
  initialIndex = 0 // Default to 0
}: VideoCarouselDialogProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(initialIndex + 1) // Initialize with initialIndex
  const [count, setCount] = useState(0)
  const videoRefs = useRef<(HTMLIFrameElement | null)[]>([])
  const currentRef = useRef(current)

  // Mirror `current` into a ref so the select handler always sees the latest
  // value without being re-registered on every change (avoids listener leaks
  // and stale closures).
  useEffect(() => {
    currentRef.current = current
  }, [current])

  // Update the current and count state when the carousel api is available
  useEffect(() => {
    if (!api) return

    // why: external-source subscription — seed count + current from the
    // embla carousel API when it mounts. React docs explicitly allow
    // setState-in-effect for external-source sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed carousel count from the embla API when it becomes available.
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap() + 1)

    const handleSelect = () => {
      const newCurrent = api.selectedScrollSnap() + 1
      const prev = currentRef.current
      if (prev !== undefined && videoRefs.current[prev - 1]) {
        videoRefs.current[prev - 1]?.contentWindow?.postMessage(
          '{"event":"command","func":"pauseVideo","args":""}',
          '*'
        )
      }
      setCurrent(newCurrent)
    }

    api.on('select', handleSelect)
    return () => {
      api.off('select', handleSelect)
    }
  }, [api])

  // Scroll to the initial index when the dialog opens and API is ready
  useEffect(() => {
    if (api) {
      api.scrollTo(initialIndex, false) // Scroll instantly
    }
  }, [api, initialIndex])

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Search Videos</DialogTitle>
          <DialogDescription className="text-sm">{query}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Carousel
            setApi={setApi}
            className="w-full bg-muted max-h-[60vh]"
            opts={{
              startIndex: initialIndex // Set initial slide
            }}
          >
            <CarouselContent>
              {videos.map((video, idx) => {
                const videoId = video.link.split('v=')[1]
                return (
                  <CarouselItem key={idx}>
                    <div className="p-1 flex items-center justify-center h-full">
                      <iframe
                        ref={el => {
                          videoRefs.current[idx] = el
                        }}
                        src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
                        className="w-full aspect-video"
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  </CarouselItem>
                )
              })}
            </CarouselContent>
            <div className="absolute inset-8 flex items-center justify-between p-4 pointer-events-none">
              <CarouselPrevious className="w-10 h-10 rounded-full shadow-sm focus:outline-hidden pointer-events-auto">
                <span className="sr-only">Previous</span>
              </CarouselPrevious>
              <CarouselNext className="w-10 h-10 rounded-full shadow-sm focus:outline-hidden pointer-events-auto">
                <span className="sr-only">Next</span>
              </CarouselNext>
            </div>
          </Carousel>
          <div className="py-2">
            <div className="text-center text-sm text-muted-foreground">
              {current} of {count}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
