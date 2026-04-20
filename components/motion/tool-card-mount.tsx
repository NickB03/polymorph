'use client'

import { type ReactNode } from 'react'

import { motion } from 'motion/react'

import { useIsNewPart } from '@/lib/motion/hydration-boundary'
import { useResolvedVariants } from '@/lib/motion/variants'

export function ToolCardMount({
  partId,
  children
}: {
  partId: string
  children: ReactNode
}) {
  const isNew = useIsNewPart(partId)
  const { cardEntrance } = useResolvedVariants()
  return (
    <motion.div
      variants={cardEntrance}
      initial={isNew ? 'initial' : false}
      animate="animate"
    >
      {children}
    </motion.div>
  )
}
