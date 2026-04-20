import { useReducedMotion } from 'motion/react'

import { motionTokens as t } from './tokens'

export const cardEntrance = {
  initial: { opacity: 0, y: t.distance.rise },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: t.duration.entrance, ease: t.ease.out }
  }
}

export const pillPresence = {
  initial: { opacity: 0, y: t.distance.rise },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: t.duration.entrance, ease: t.ease.out }
  },
  exit: {
    opacity: 0,
    y: t.distance.rise * 0.5,
    transition: { duration: t.duration.exit, ease: t.ease.in }
  }
}

export const staggerParent = {
  animate: { transition: { staggerChildren: t.duration.stagger } }
}

export const staggerChild = cardEntrance

const identityCard = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0, transition: { duration: 0 } }
}

const identityPill = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0, transition: { duration: 0 } },
  exit: { opacity: 1, y: 0, transition: { duration: 0 } }
}

const identityStaggerParent = {
  animate: { transition: { staggerChildren: 0 } }
}

export type ResolvedVariants = {
  cardEntrance: typeof cardEntrance | typeof identityCard
  pillPresence: typeof pillPresence | typeof identityPill
  staggerParent: typeof staggerParent | typeof identityStaggerParent
  staggerChild: typeof staggerChild | typeof identityCard
}

export function useResolvedVariants(): ResolvedVariants {
  const reduce = useReducedMotion()
  if (!reduce)
    return { cardEntrance, pillPresence, staggerParent, staggerChild }
  return {
    cardEntrance: identityCard,
    pillPresence: identityPill,
    staggerParent: identityStaggerParent,
    staggerChild: identityCard
  }
}
