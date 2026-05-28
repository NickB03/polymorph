'use client'

import { useEffect } from 'react'

import { useIsMobile } from '@/hooks/use-mobile'

import type { TourStep } from './tour'
import { useTour } from './tour'
import { TOUR_STEP_IDS } from './tour-constants'

function StepContent({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  )
}

const onboardingSteps: TourStep[] = [
  {
    selectorId: TOUR_STEP_IDS.CHAT_INPUT,
    position: 'top',
    content: (
      <StepContent
        title="Start chatting"
        description="Type anything here. Polymorph streams responses and renders interactive UI inline."
      />
    )
  },
  {
    selectorId: TOUR_STEP_IDS.MODE_SELECTOR,
    position: 'top',
    content: (
      <StepContent
        title="Pick a mode"
        description="Switch between Research (multi-step with citations) and Build (code & artifact authoring)."
      />
    )
  },
  {
    selectorId: TOUR_STEP_IDS.SUGGESTIONS,
    position: 'top',
    content: (
      <StepContent
        title="Try a starter"
        description="Pick a prompt to see what Polymorph can do without typing anything."
      />
    )
  },
  {
    selectorId: TOUR_STEP_IDS.SIDEBAR,
    position: 'right',
    content: (
      <StepContent
        title="Your chats"
        description="Every conversation is saved here. Open one to keep working or branch a new direction."
      />
    )
  }
]

export function OnboardingTour() {
  const { setSteps } = useTour()
  const isMobile = useIsMobile()
  useEffect(() => {
    // The 4th step targets the desktop sidebar panel. On mobile that surface is a
    // portaled <Sheet> which doesn't expose a stable DOM target, so we drop the
    // step rather than show a spotlight in the wrong place.
    setSteps(isMobile ? onboardingSteps.slice(0, 3) : onboardingSteps)
  }, [setSteps, isMobile])
  return null
}

export function useTourAutoStart({
  isFirstVisit,
  delay = 1000
}: {
  isFirstVisit: boolean
  delay?: number
}) {
  const { startTour, isTourCompleted, steps } = useTour()
  useEffect(() => {
    if (!isFirstVisit || isTourCompleted || steps.length === 0) return
    const timer = setTimeout(() => startTour(), delay)
    return () => clearTimeout(timer)
  }, [isFirstVisit, isTourCompleted, steps.length, startTour, delay])
}
