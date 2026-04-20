'use client'

import { type ReactNode } from 'react'

import { motion, useReducedMotion } from 'motion/react'

import { motionTokens as t } from '@/lib/motion/tokens'

const STAGGER_CAP = 10
const LATE_ENTRANCE_DELAY = 0.5

export function StaggerList<T>({
  items,
  getKey,
  itemClassName,
  className,
  ariaLabel,
  children
}: {
  items: readonly T[]
  getKey: (item: T, index: number) => string
  itemClassName?: string
  className?: string
  ariaLabel?: string
  children: (item: T, index: number, isLast: boolean) => ReactNode
}) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <ol className={className} aria-label={ariaLabel}>
        {items.map((item, index) => (
          <li
            key={getKey(item, index)}
            className={itemClassName}
            data-stagger-delay={0}
          >
            {children(item, index, index === items.length - 1)}
          </li>
        ))}
      </ol>
    )
  }

  return (
    <motion.ol className={className} aria-label={ariaLabel} initial={false}>
      {items.map((item, index) => {
        const delay =
          index < STAGGER_CAP ? index * t.duration.stagger : LATE_ENTRANCE_DELAY
        return (
          <motion.li
            key={getKey(item, index)}
            className={itemClassName}
            data-stagger-delay={delay}
            initial={{ opacity: 0, y: t.distance.rise }}
            animate={{
              opacity: 1,
              y: 0,
              transition: {
                duration: t.duration.entrance,
                ease: t.ease.out,
                delay
              }
            }}
          >
            {children(item, index, index === items.length - 1)}
          </motion.li>
        )
      })}
    </motion.ol>
  )
}
