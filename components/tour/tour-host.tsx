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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
