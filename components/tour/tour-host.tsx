'use client'

import { useEffect, useState } from 'react'

import { OnboardingTour, useTourAutoStart } from './onboarding-tour'
import { TourAlertDialog, TourProvider } from './tour'
import { TOUR_STORAGE_KEYS } from './tour-constants'

const TOUR_ID = 'polymorph-onboarding'

function detectFirstVisit(): boolean {
  try {
    return (
      localStorage.getItem(
        `${TOUR_STORAGE_KEYS.TOUR_STATE_PREFIX}${TOUR_ID}`
      ) === null
    )
  } catch {
    // Private browsing or storage disabled — treat as NOT a first visit so the welcome dialog stays hidden.
    return false
  }
}

function TourHostInner({ isFirstVisit }: { isFirstVisit: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(isFirstVisit)
  useTourAutoStart({ isFirstVisit: false })
  return (
    <>
      <OnboardingTour />
      <TourAlertDialog isOpen={dialogOpen} setIsOpen={setDialogOpen} />
    </>
  )
}

export function TourHost() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical client-mount gate; runs exactly once after first paint to enable localStorage reads safely
    setMounted(true)
  }, [])

  if (!mounted) return null

  const isFirstVisit = detectFirstVisit()

  return (
    <TourProvider tourId={TOUR_ID}>
      <TourHostInner isFirstVisit={isFirstVisit} />
    </TourProvider>
  )
}
