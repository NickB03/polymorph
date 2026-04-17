'use client'

import { useEffect, useState } from 'react'

/**
 * Hook that tracks whether a content block has entered the DOM for the first time.
 * Returns a class name and style for a one-shot fade+slide-up entrance animation.
 * The animation only plays once — subsequent re-renders won't re-trigger it.
 *
 * @param delayMs - animation delay in milliseconds (for staggering multiple blocks)
 */
export function useContentEntrance(delayMs = 0) {
  const [hasEntered, setHasEntered] = useState(false)

  useEffect(() => {
    // why: intentional two-phase render so CSS sees a class transition from
    // opacity-0 → animate-content-enter on mount. Setting hasEntered during
    // render would skip the transition entirely; the React-blessed way to
    // trigger a one-shot entrance animation is exactly this pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasEntered(true)
  }, [])

  return {
    entranceProps: {
      className: hasEntered ? 'animate-content-enter' : 'opacity-0',
      style: { '--enter-delay': `${delayMs}ms` } as React.CSSProperties
    }
  }
}
