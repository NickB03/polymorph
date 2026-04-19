'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import { useSidebar } from '@/components/ui/sidebar'

import { useActivity } from '@/components/activity/activity-context'
import { ActivityDrawer } from '@/components/activity/activity-drawer'
import { ActivityPanel } from '@/components/activity/activity-panel'
import { InspectorDrawer } from '@/components/inspector/inspector-drawer'
import { InspectorPanel } from '@/components/inspector/inspector-panel'

import { useCanvas } from './canvas-context'
import { CanvasWorkspace } from './canvas-workspace'

const DEFAULT_WIDTH = 500
const MIN_WIDTH = 320
const MAX_WIDTH = 800
const CHAT_MIN_WIDTH = 360
const RESIZE_OVERLAY_Z_INDEX = 9999

// Helper function to calculate allowed width bounds
function getAllowedWidthBounds(containerWidth: number): {
  allowedMin: number
  allowedMax: number
} {
  const available = Math.max(0, containerWidth - CHAT_MIN_WIDTH)
  const allowedMax = Math.min(MAX_WIDTH, available)

  // If there's no space available, hide the panel entirely
  if (allowedMax === 0) {
    return { allowedMin: 0, allowedMax: 0 }
  }

  // Ensure minimum width doesn't exceed available space
  const allowedMin = Math.min(MIN_WIDTH, allowedMax)
  return { allowedMin, allowedMax }
}

export interface ChatCanvasShellProps {
  children: React.ReactNode
  /** Whether the inspector panel is open */
  isInspectorOpen?: boolean
}

export function ChatCanvasShell({
  children,
  isInspectorOpen = false
}: ChatCanvasShellProps) {
  const activity = useActivity()
  const canvas = useCanvas()
  const { open: sidebarOpen, setOpen: setSidebarOpen, isMobile } = useSidebar()

  const activePanel: 'workspace' | 'inspector' | 'activity' | null =
    canvas.isWorkspaceOpen
      ? 'workspace'
      : isInspectorOpen
        ? 'inspector'
        : activity.state.isOpen
          ? 'activity'
          : null

  // Auto-collapse sidebar when the canvas workspace opens to maximize space
  const prevWorkspaceOpen = useRef(canvas.isWorkspaceOpen)
  useEffect(() => {
    if (
      canvas.isWorkspaceOpen &&
      !prevWorkspaceOpen.current &&
      sidebarOpen &&
      !isMobile
    ) {
      setSidebarOpen(false)
    }
    prevWorkspaceOpen.current = canvas.isWorkspaceOpen
  }, [canvas.isWorkspaceOpen, sidebarOpen, setSidebarOpen, isMobile])

  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)

  // Load saved width after hydration
  useEffect(() => {
    let savedWidth: string | null = null
    try {
      savedWidth = localStorage.getItem('artifactPanelWidth')
    } catch {
      // localStorage may be unavailable in some environments
    }
    if (savedWidth) {
      const parsedWidth = parseInt(savedWidth, 10)
      // Ensure parsedWidth is at least MIN_WIDTH to prevent invalid panel states
      if (
        !isNaN(parsedWidth) &&
        parsedWidth >= MIN_WIDTH &&
        parsedWidth <= MAX_WIDTH
      ) {
        // Clamp against available space considering chat minimum width
        const containerRect = containerRef.current?.getBoundingClientRect()
        if (containerRect) {
          const { allowedMin, allowedMax } = getAllowedWidthBounds(
            containerRect.width
          )
          const clamped = Math.min(
            Math.max(parsedWidth, allowedMin),
            allowedMax
          )
          setWidth(clamped)
        } else {
          setWidth(parsedWidth)
        }
      }
    }
  }, [])

  // Keep width in bounds when container resizes (e.g., window resize)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { allowedMin, allowedMax } = getAllowedWidthBounds(
          entry.contentRect.width
        )
        setWidth(prev => Math.min(Math.max(prev, allowedMin), allowedMax))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (containerRect) {
        const newWidth = containerRect.right - e.clientX
        const { allowedMin, allowedMax } = getAllowedWidthBounds(
          containerRect.width
        )
        const clampedWidth = Math.min(
          Math.max(newWidth, allowedMin),
          allowedMax
        )
        setWidth(clampedWidth)
        try {
          localStorage.setItem('artifactPanelWidth', clampedWidth.toString())
        } catch {
          // localStorage may be unavailable in some environments
        }
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  return (
    <div className="flex-1 min-h-0 min-w-0 h-screen flex">
      <div
        ref={containerRef}
        className="relative flex flex-1 min-w-0 overflow-hidden"
      >
        <div
          className="relative flex flex-1 min-w-0 flex-col"
          data-testid="mobile-shell"
        >
          {/* Keep the chat subtree mounted exactly once. On mobile, hide it
              with CSS while the workspace overlays on top so refs/state survive. */}
          <div
            className={cn(
              'flex flex-1 min-h-0 min-w-0 flex-col',
              canvas.isWorkspaceOpen &&
                'invisible h-0 overflow-hidden md:visible md:h-auto md:overflow-visible'
            )}
          >
            {children}
            <div className="md:hidden">
              <InspectorDrawer />
              <ActivityDrawer />
            </div>
          </div>

          {/* Mobile: full-screen takeover — workspace overlays chat */}
          {canvas.isWorkspaceOpen && (
            <div className="absolute inset-0 md:hidden">
              <CanvasWorkspace />
            </div>
          )}
        </div>

        {/* Desktop: independent resizable right panel */}
        {activePanel && (
          <div
            className={cn(
              'mx-0.5 my-6 hidden w-1 cursor-col-resize select-none relative transition-colors duration-200 hover:bg-border md:block',
              isResizing && 'bg-border/50'
            )}
            onMouseDown={startResize}
          >
            <div className="absolute inset-0 -left-2 -right-2" />
          </div>
        )}

        {/* Right Panel - Independent with own animation */}
        <div
          className={cn(
            'hidden bg-background overflow-hidden md:block',
            activePanel ? 'opacity-100' : 'w-0 opacity-0 pointer-events-none',
            !isResizing && 'transition-all duration-300 ease-out'
          )}
          style={{
            width: activePanel ? `${width}px` : '0px'
          }}
        >
          <div className="h-full" style={{ width: `${width}px` }}>
            {activePanel === 'workspace' && <CanvasWorkspace />}
            {activePanel === 'inspector' && <InspectorPanel />}
            {activePanel === 'activity' && <ActivityPanel />}
          </div>
        </div>
      </div>

      {/* Resize overlay to prevent text selection */}
      {isResizing && (
        <div
          className="fixed inset-0 cursor-col-resize select-none"
          style={{ zIndex: RESIZE_OVERLAY_Z_INDEX }}
        />
      )}
    </div>
  )
}
