'use client'

import type React from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { useReducedMotion } from '@/lib/motion/use-reduced-motion'
import { cn } from '@/lib/utils'

import { useIsMobile } from '@/hooks/use-mobile'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

import { TOUR_STORAGE_KEYS } from './tour-constants'

// ============================================================================
// Dev logging
// ============================================================================

const isDev = process.env.NODE_ENV !== 'production'
function warn(message: string, meta?: Record<string, unknown>) {
  if (isDev) console.warn(`[tour] ${message}`, meta ?? {})
}

// ============================================================================
// Types
// ============================================================================

export interface TourStep {
  content: React.ReactNode
  selectorId: string
  width?: number
  height?: number
  onClickWithinArea?: () => void
  position?: 'top' | 'bottom' | 'left' | 'right'
}

interface TourContextType {
  currentStep: number
  totalSteps: number
  nextStep: () => void
  previousStep: () => void
  endTour: () => void
  isActive: boolean
  startTour: () => void
  setSteps: (steps: TourStep[]) => void
  steps: TourStep[]
  isTourCompleted: boolean
  setIsTourCompleted: (completed: boolean) => void
}

interface TourProviderProps {
  children: React.ReactNode
  onComplete?: () => void
  onSkip?: (completedSteps: number) => void
  className?: string
  isTourCompleted?: boolean
  tourId?: string
}

// ============================================================================
// Constants
// ============================================================================

const PADDING = 16
const CONTENT_WIDTH = 420
const CONTENT_HEIGHT = 220
const TOUR_STORAGE_KEY_PREFIX = TOUR_STORAGE_KEYS.TOUR_STATE_PREFIX

// ============================================================================
// Utilities
// ============================================================================

function getElementPosition(id: string, stepIndex?: number, tourId?: string) {
  const element = document.getElementById(id)
  if (!element) {
    warn(
      `Target element "${id}" not found in DOM. Ensure the element has id="${id}" and is rendered before starting the tour.`,
      {
        selectorId: id,
        stepIndex,
        tourId,
        availableIds: Array.from(document.querySelectorAll('[id]'))
          .map(el => el.id)
          .slice(0, 20)
      }
    )
    return null
  }
  const rect = element.getBoundingClientRect()
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height
  }
}

function calculateContentPosition(
  elementPos: { top: number; left: number; width: number; height: number },
  position: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
) {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const isMobile = viewportWidth < 768

  // Calculate responsive content width
  const contentWidth = Math.min(CONTENT_WIDTH, viewportWidth - 32)

  let left = elementPos.left
  let top = elementPos.top

  // On mobile, prefer top/bottom positioning to avoid horizontal overflow
  const effectivePosition =
    isMobile && (position === 'left' || position === 'right')
      ? 'bottom'
      : position

  switch (effectivePosition) {
    case 'top':
      top = elementPos.top - CONTENT_HEIGHT - PADDING
      left = elementPos.left + elementPos.width / 2 - contentWidth / 2
      break
    case 'bottom':
      top = elementPos.top + elementPos.height + PADDING
      left = elementPos.left + elementPos.width / 2 - contentWidth / 2
      break
    case 'left':
      left = elementPos.left - contentWidth - PADDING
      top = elementPos.top + elementPos.height / 2 - CONTENT_HEIGHT / 2
      break
    case 'right':
      left = elementPos.left + elementPos.width + PADDING
      top = elementPos.top + elementPos.height / 2 - CONTENT_HEIGHT / 2
      break
  }

  return {
    top: Math.max(
      PADDING,
      Math.min(top, viewportHeight - CONTENT_HEIGHT - PADDING)
    ),
    left: Math.max(
      PADDING,
      Math.min(left, viewportWidth - contentWidth - PADDING)
    ),
    width: contentWidth,
    height: CONTENT_HEIGHT
  }
}

// ============================================================================
// Context
// ============================================================================

const TourContext = createContext<TourContextType | null>(null)

// ============================================================================
// TourProvider Component
// ============================================================================

export function TourProvider({
  children,
  onComplete,
  onSkip,
  className,
  isTourCompleted = false,
  tourId = 'default'
}: TourProviderProps) {
  const storageKey = `${TOUR_STORAGE_KEY_PREFIX}${tourId}`

  const [steps, setStepsState] = useState<TourStep[]>([])
  const [currentStep, setCurrentStep] = useState(-1)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [elementPosition, setElementPosition] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const [isCompleted, setIsCompleted] = useState(() => {
    // Lazy initializer: read persisted completion from localStorage on first render
    if (isTourCompleted) return true
    try {
      const saved =
        typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed.completed === 'boolean') return parsed.completed
      }
    } catch {
      // Ignore — storage read failed, start fresh
    }
    return false
  })

  const contentRef = useRef<HTMLDivElement>(null)
  const handleClickRef = useRef<((e: MouseEvent) => void) | null>(null)
  // Keep a ref so startTour can read the latest steps synchronously
  // even when called in the same batch as setSteps
  const stepsRef = useRef<TourStep[]>([])
  const reducedMotion = useReducedMotion()

  // Persist state changes
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          completed: isCompleted,
          lastStep: currentStep
        })
      )
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'QuotaExceededError'
      ) {
        warn('localStorage quota exceeded - tour state will not persist', {
          storageKey,
          isCompleted,
          currentStep
        })
      } else {
        warn('Failed to save tour state', {
          storageKey,
          errorType: error instanceof Error ? error.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }, [isCompleted, currentStep, storageKey])

  const updateElementPosition = useCallback(() => {
    if (currentStep >= 0 && currentStep < steps.length) {
      const position = getElementPosition(
        steps[currentStep]?.selectorId ?? '',
        currentStep,
        tourId
      )
      if (position) {
        setElementPosition(position)
      }
    }
  }, [currentStep, steps, tourId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync element position from DOM on step change and viewport events; this is the external-system pattern
    updateElementPosition()
    window.addEventListener('resize', updateElementPosition)
    window.addEventListener('scroll', updateElementPosition)

    return () => {
      window.removeEventListener('resize', updateElementPosition)
      window.removeEventListener('scroll', updateElementPosition)
    }
  }, [updateElementPosition])

  // Focus management - focus tooltip when step changes
  useEffect(() => {
    if (currentStep >= 0 && contentRef.current) {
      contentRef.current.focus()
    }
  }, [currentStep])

  const nextStep = useCallback(() => {
    setDirection('next')
    setCurrentStep(prev => {
      const isLastStep = prev >= steps.length - 1

      if (isLastStep) {
        // Trigger completion inside the updater to use correct state
        setIsCompleted(true)
        onComplete?.()
        return -1
      }
      return prev + 1
    })
  }, [steps.length, onComplete])

  const previousStep = useCallback(() => {
    setDirection('prev')
    setCurrentStep(prev => (prev > 0 ? prev - 1 : prev))
  }, [])

  const endTour = useCallback(() => {
    const wasSkipped = currentStep >= 0 && currentStep < steps.length - 1
    if (wasSkipped && onSkip) {
      onSkip(currentStep + 1)
    }
    setCurrentStep(-1)
    // Mark tour as completed when user closes it (via X button or Escape)
    // This prevents the TourAlertDialog from reappearing
    setIsCompleted(true)
  }, [currentStep, steps.length, onSkip])

  const startTour = useCallback(() => {
    if (isCompleted) {
      warn(
        'Attempted to start completed tour. Call setIsTourCompleted(false) first to restart.',
        {
          tourId
        }
      )
      return
    }

    if (stepsRef.current.length === 0) {
      warn(
        'Cannot start tour: No steps defined. Call setSteps() with tour step configuration before starting.',
        { tourId }
      )
      return
    }

    setDirection('next')
    setCurrentStep(0)
  }, [isCompleted, tourId])

  // Keyboard navigation
  useEffect(() => {
    if (currentStep < 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault()
          nextStep()
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (currentStep > 0) previousStep()
          break
        case 'Escape':
          e.preventDefault()
          endTour()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentStep, nextStep, previousStep, endTour])

  // eslint-disable-next-line react-hooks/refs -- keep latest click handler available to a stable event listener without re-registering on every step change
  handleClickRef.current = (e: MouseEvent) => {
    if (
      currentStep >= 0 &&
      elementPosition &&
      steps[currentStep]?.onClickWithinArea
    ) {
      const clickX = e.clientX + window.scrollX
      const clickY = e.clientY + window.scrollY

      const isWithinBounds =
        clickX >= elementPosition.left &&
        clickX <=
          elementPosition.left +
            (steps[currentStep]?.width || elementPosition.width) &&
        clickY >= elementPosition.top &&
        clickY <=
          elementPosition.top +
            (steps[currentStep]?.height || elementPosition.height)

      if (isWithinBounds) {
        steps[currentStep].onClickWithinArea?.()
      }
    }
  }

  // Stable event listener that delegates to ref (prevents memory leak)
  useEffect(() => {
    const stableClickHandler = (e: MouseEvent) => {
      handleClickRef.current?.(e)
    }

    window.addEventListener('click', stableClickHandler)
    return () => {
      window.removeEventListener('click', stableClickHandler)
    }
  }, []) // Empty deps - listener is stable, ref updates

  const setSteps = useCallback((newSteps: TourStep[]) => {
    // Update ref synchronously so startTour can read latest steps
    // even when called in the same React batch as setSteps
    stepsRef.current = newSteps
    setStepsState(newSteps)
  }, [])

  const setIsTourCompleted = useCallback((completed: boolean) => {
    setIsCompleted(completed)
  }, [])

  // Animation variants - memoized to prevent unnecessary recreations
  const overlayAnimation = useMemo(
    () => ({
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 }
    }),
    []
  )

  const spotlightAnimation = useMemo(
    () =>
      reducedMotion
        ? {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 }
          }
        : {
            initial: { opacity: 0, scale: 0.95 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.95 }
          },
    [reducedMotion]
  )

  const contentSlideDirection = direction === 'next' ? 1 : -1
  const contentAnimation = useMemo(
    () =>
      reducedMotion
        ? {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 }
          }
        : {
            initial: {
              opacity: 0,
              x: 20 * contentSlideDirection,
              filter: 'blur(4px)'
            },
            animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
            exit: {
              opacity: 0,
              x: -20 * contentSlideDirection,
              filter: 'blur(4px)'
            }
          },
    [reducedMotion, contentSlideDirection]
  )

  return (
    <TourContext.Provider
      value={{
        currentStep,
        totalSteps: steps.length,
        nextStep,
        previousStep,
        endTour,
        isActive: currentStep >= 0,
        startTour,
        setSteps,
        steps,
        isTourCompleted: isCompleted,
        setIsTourCompleted
      }}
    >
      {children}
      <AnimatePresence>
        {currentStep >= 0 && elementPosition && (
          <>
            {/* Dark overlay with spotlight cutout */}
            <motion.div
              {...overlayAnimation}
              transition={{ duration: reducedMotion ? 0.1 : 0.3 }}
              className="fixed inset-0 z-50 overflow-hidden bg-black/70"
              style={{
                clipPath: `polygon(
                  0% 0%,
                  0% 100%,
                  100% 100%,
                  100% 0%,
                  ${elementPosition.left}px 0%,
                  ${elementPosition.left}px ${elementPosition.top}px,
                  ${elementPosition.left + (steps[currentStep]?.width || elementPosition.width)}px ${elementPosition.top}px,
                  ${elementPosition.left + (steps[currentStep]?.width || elementPosition.width)}px ${elementPosition.top + (steps[currentStep]?.height || elementPosition.height)}px,
                  ${elementPosition.left}px ${elementPosition.top + (steps[currentStep]?.height || elementPosition.height)}px,
                  ${elementPosition.left}px 0%
                )`,
                transition: reducedMotion
                  ? 'none'
                  : 'clip-path 0.5s cubic-bezier(0.25, 0.1, 0.25, 1)'
              }}
              aria-hidden="true"
            />

            {/* Spotlight ring around target element */}
            {(() => {
              // Calculate viewport-safe dimensions to prevent ring-offset clipping
              const ringOffset = 8 // ring-offset-2 = 0.5rem = 8px
              const viewportWidth = window.innerWidth
              const viewportHeight = window.innerHeight

              const stepWidth =
                steps[currentStep]?.width || elementPosition.width
              const stepHeight =
                steps[currentStep]?.height || elementPosition.height

              // Check if element touches viewport edges
              const touchesTop = elementPosition.top <= ringOffset
              const touchesBottom =
                elementPosition.top + stepHeight >= viewportHeight - ringOffset
              const touchesLeft = elementPosition.left <= ringOffset
              const touchesRight =
                elementPosition.left + stepWidth >= viewportWidth - ringOffset

              // Inset the spotlight to keep ring-offset visible within viewport
              const adjustedTop = touchesTop
                ? elementPosition.top + ringOffset
                : elementPosition.top
              const adjustedLeft = touchesLeft
                ? elementPosition.left + ringOffset
                : elementPosition.left
              const adjustedWidth =
                stepWidth -
                (touchesLeft ? ringOffset : 0) -
                (touchesRight ? ringOffset : 0)
              const adjustedHeight =
                stepHeight -
                (touchesTop ? ringOffset : 0) -
                (touchesBottom ? ringOffset : 0)

              return (
                <motion.div
                  {...spotlightAnimation}
                  transition={{ duration: reducedMotion ? 0.1 : 0.3 }}
                  style={{
                    position: 'fixed',
                    top: adjustedTop,
                    left: adjustedLeft,
                    width: adjustedWidth,
                    height: adjustedHeight
                  }}
                  className={cn(
                    'z-[100] rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background',
                    className
                  )}
                  aria-hidden="true"
                />
              )
            })()}

            {/* Tour content tooltip */}
            {currentStep >= 0 &&
              elementPosition &&
              (() => {
                const tooltipPos = calculateContentPosition(
                  elementPosition,
                  steps[currentStep]?.position
                )
                return (
                  <motion.div
                    ref={contentRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Tour step ${currentStep + 1} of ${steps.length}`}
                    tabIndex={-1}
                    initial={
                      reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
                    }
                    animate={{
                      opacity: 1,
                      y: 0,
                      top: tooltipPos.top,
                      left: tooltipPos.left
                    }}
                    transition={{
                      duration: reducedMotion ? 0.1 : 0.5,
                      ease: [0.16, 1, 0.3, 1],
                      opacity: { duration: reducedMotion ? 0.1 : 0.3 }
                    }}
                    exit={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
                    style={{
                      position: 'fixed',
                      width: `min(${CONTENT_WIDTH}px, calc(100vw - 32px))`,
                      maxWidth: 'calc(100vw - 32px)'
                    }}
                    className="bg-popover text-popover-foreground relative z-[100] rounded-lg border p-5 shadow-lg outline-none"
                  >
                    {/* Close button - top right (44x44px touch target for mobile accessibility) */}
                    <button
                      onClick={endTour}
                      className="absolute top-1 right-1 z-10 size-11 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      aria-label="Close tour"
                    >
                      <X className="h-5 w-5" />
                    </button>

                    {/* Step counter - top left */}
                    <span className="absolute top-3 left-4 text-sm text-muted-foreground tabular-nums">
                      {currentStep + 1} / {steps.length}
                    </span>

                    {/* Step content with directional animation */}
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`tour-content-${currentStep}`}
                        {...contentAnimation}
                        transition={{ duration: reducedMotion ? 0.1 : 0.25 }}
                        className="overflow-hidden pt-4"
                      >
                        {steps[currentStep]?.content}
                      </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div
                      className="mt-4 flex items-center justify-between"
                      role="navigation"
                      aria-label="Tour navigation"
                    >
                      {/* Previous button - left (44px height for mobile touch targets) */}
                      {currentStep > 0 ? (
                        <Button
                          onClick={previousStep}
                          variant="ghost"
                          className="h-11 px-4"
                          aria-label={`Go to previous step (${currentStep} of ${steps.length})`}
                        >
                          Previous
                        </Button>
                      ) : (
                        <div />
                      )}

                      {/* Next button - right (44px height for mobile touch targets) */}
                      <Button
                        onClick={nextStep}
                        className="h-11 px-4"
                        aria-label={
                          currentStep === steps.length - 1
                            ? 'Finish tour'
                            : `Go to next step (${currentStep + 2} of ${steps.length})`
                        }
                      >
                        {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                      </Button>
                    </div>
                  </motion.div>
                )
              })()}
          </>
        )}
      </AnimatePresence>
    </TourContext.Provider>
  )
}

// ============================================================================
// useTour Hook
// ============================================================================

export function useTour() {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error('useTour must be used within a TourProvider')
  }
  return context
}

// ============================================================================
// TourAlertDialog Component
// ============================================================================

export function TourAlertDialog({
  isOpen,
  setIsOpen
}: {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const { startTour, steps, isTourCompleted, currentStep } = useTour()
  const isMobile = useIsMobile()

  if (isTourCompleted || steps.length === 0 || currentStep > -1) {
    return null
  }

  const handleSkip = () => {
    setIsOpen(false)
  }

  return (
    <AlertDialog open={isOpen}>
      {isMobile ? (
        <MobileTourDialog onStartTour={startTour} onSkip={handleSkip} />
      ) : (
        <DesktopTourDialog onStartTour={startTour} onSkip={handleSkip} />
      )}
    </AlertDialog>
  )
}

// ============================================================================
// DesktopTourDialog Component
// ============================================================================

function DesktopTourDialog({
  onStartTour,
  onSkip
}: {
  onStartTour: () => void
  onSkip: () => void
}) {
  const reducedMotion = useReducedMotion()
  const imageAnimation = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { scale: 0.95, opacity: 0 },
        animate: { scale: 1, opacity: 1 }
      }
  const imageTransition = reducedMotion
    ? { duration: 0.15 }
    : { duration: 0.2, ease: 'easeOut' as const }

  return (
    <AlertDialogContent className="max-w-3xl w-[calc(100vw-32px)] sm:w-full p-0 flex flex-col overflow-hidden bg-card border-border shadow-xl">
      <AlertDialogTitle className="sr-only">
        Welcome to Polymorph — an AI platform with a generative UI
      </AlertDialogTitle>
      <AlertDialogDescription className="sr-only">
        Learn about Polymorph&apos;s chat, modes, canvas artifacts, and how to
        start the tour.
      </AlertDialogDescription>
      <div className="flex flex-col p-8 max-h-[85vh] overflow-y-auto">
        <motion.div
          {...imageAnimation}
          transition={imageTransition}
          className="mb-6"
        >
          <div className="text-2xl font-semibold text-foreground">
            Polymorph
          </div>
          <p className="text-sm text-muted-foreground mt-1 text-pretty leading-relaxed">
            An AI platform with a generative UI for research, creation, and
            exploration.
          </p>
        </motion.div>

        <div className="mb-6">
          <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-3">
            Capabilities
          </h4>
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Chat</p>
              <p className="text-xs text-muted-foreground">
                Streaming responses
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Research mode
              </p>
              <p className="text-xs text-muted-foreground">
                Multi-step with citations
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Build mode</p>
              <p className="text-xs text-muted-foreground">
                Code &amp; artifact authoring
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Canvas</p>
              <p className="text-xs text-muted-foreground">
                Interactive HTML &amp; React artifacts
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Generative UI
              </p>
              <p className="text-xs text-muted-foreground">
                Tool-specific message parts
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Search</p>
              <p className="text-xs text-muted-foreground">
                Multiple providers
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-3">
            Stack
          </h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex">
              <span className="text-muted-foreground w-24 shrink-0">
                Frontend
              </span>
              <span className="text-foreground">
                Next.js 16, React 19, Tailwind v4
              </span>
            </div>
            <div className="flex">
              <span className="text-muted-foreground w-24 shrink-0">
                Backend
              </span>
              <span className="text-foreground">Supabase, Drizzle, Bun</span>
            </div>
            <div className="flex">
              <span className="text-muted-foreground w-24 shrink-0">
                Observability
              </span>
              <span className="text-foreground">Phoenix (Arize)</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-2 pt-4 border-t border-border/50">
          <Button
            onClick={onSkip}
            variant="ghost"
            className="flex-1 h-11 font-medium bg-muted/50 hover:bg-muted"
          >
            Skip
          </Button>
          <Button onClick={onStartTour} className="flex-1 h-11 font-medium">
            Start the tour
          </Button>
        </div>
      </div>
    </AlertDialogContent>
  )
}

// ============================================================================
// MobileTourDialog Component
// ============================================================================

function MobileTourDialog({
  onStartTour,
  onSkip
}: {
  onStartTour: () => void
  onSkip: () => void
}) {
  return (
    <AlertDialogContent className="w-[calc(100vw-32px)] max-w-[360px] p-0 flex flex-col overflow-hidden bg-card border-border shadow-xl rounded-xl">
      <AlertDialogTitle className="sr-only">
        Welcome to Polymorph
      </AlertDialogTitle>
      <AlertDialogDescription className="sr-only">
        Learn about Polymorph&apos;s capabilities and start the tour.
      </AlertDialogDescription>

      <div className="flex flex-col px-4 pt-4 pb-3">
        <h2 className="text-lg font-bold text-foreground">
          Welcome to Polymorph
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">
          An AI platform with a generative UI for research, creation, and
          exploration.
        </p>

        <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-wide mb-1.5">
          Capabilities
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] mb-3">
          <div>
            <span className="text-muted-foreground">Chat</span>
            <p className="text-foreground">Streaming responses</p>
          </div>
          <div>
            <span className="text-muted-foreground">Research</span>
            <p className="text-foreground">Multi-step + citations</p>
          </div>
          <div>
            <span className="text-muted-foreground">Build</span>
            <p className="text-foreground">Code &amp; artifacts</p>
          </div>
          <div>
            <span className="text-muted-foreground">Canvas</span>
            <p className="text-foreground">HTML &amp; React</p>
          </div>
          <div>
            <span className="text-muted-foreground">Gen UI</span>
            <p className="text-foreground">Tool-specific parts</p>
          </div>
          <div>
            <span className="text-muted-foreground">Search</span>
            <p className="text-foreground">Multiple providers</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onSkip}
            variant="ghost"
            className="flex-1 h-10 text-sm bg-muted/40 hover:bg-muted rounded-lg"
          >
            Skip
          </Button>
          <Button
            onClick={onStartTour}
            className="flex-1 h-10 text-sm font-medium rounded-lg"
          >
            Start tour
          </Button>
        </div>
      </div>
    </AlertDialogContent>
  )
}
