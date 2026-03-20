'use client'

import {
  LightbulbIcon,
  ListTodo,
  MessageSquare,
  Minimize2,
  Search
} from 'lucide-react'

import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TooltipButton } from '@/components/ui/tooltip-button'

/**
 * InspectorPanel is a placeholder during Stage 1 of the canvas migration.
 * The old artifact-based inspector has been removed. A new canvas-aware
 * inspector will be implemented in a later stage.
 */
export function InspectorPanel() {
  // During Stage 1, the inspector panel has no content to show.
  // It will be re-wired with canvas context in a later task.
  return null
}
