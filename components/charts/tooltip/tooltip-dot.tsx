'use client'

import { motion, useReducedMotion, useSpring } from 'motion/react'
import { chartCssVars } from '../chart-context'

// Faster spring to stay in sync with indicator
const crosshairSpringConfig = { stiffness: 300, damping: 30 }

export interface TooltipDotProps {
  x: number
  y: number
  visible: boolean
  color: string
  size?: number
  strokeColor?: string
  strokeWidth?: number
}

export function TooltipDot({
  x,
  y,
  visible,
  color,
  size = 5,
  strokeColor = chartCssVars.background,
  strokeWidth = 2
}: TooltipDotProps) {
  const reduce = useReducedMotion()
  const springConfig = reduce ? { duration: 0 } : crosshairSpringConfig
  const animatedX = useSpring(x, springConfig)
  const animatedY = useSpring(y, springConfig)

  animatedX.set(x)
  animatedY.set(y)

  if (!visible) {
    return null
  }

  return (
    <motion.circle
      cx={animatedX}
      cy={animatedY}
      fill={color}
      r={size}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
    />
  )
}

TooltipDot.displayName = 'TooltipDot'

export default TooltipDot
