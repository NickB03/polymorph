'use client'

import { type ReactNode } from 'react'

import { AnimatePresence, motion } from 'motion/react'

import { useResolvedVariants } from '@/lib/motion/variants'

export function PillPresence({
  activeKey,
  children
}: {
  activeKey: string | null
  children: ReactNode
}) {
  const { pillPresence } = useResolvedVariants()
  return (
    <AnimatePresence mode="popLayout">
      {activeKey && (
        <motion.div
          key={activeKey}
          variants={pillPresence}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
