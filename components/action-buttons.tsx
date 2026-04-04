'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

import {
  Blocks,
  FileText,
  HelpCircle,
  LucideIcon,
  Newspaper,
  Scale,
  Search
} from 'lucide-react'

import type { BuildTemplate } from '@/lib/constants/build-templates'
import { BUILD_TEMPLATES } from '@/lib/constants/build-templates'
import type { SuggestionCategory } from '@/lib/types'
import { cn } from '@/lib/utils'

import { Button } from './ui/button'

// Constants for timing delays
const FOCUS_OUT_DELAY_MS = 100 // Delay to ensure focus has actually moved

interface ActionCategory {
  icon: LucideIcon
  label: string
  key: SuggestionCategory
}

const actionCategories: ActionCategory[] = [
  {
    icon: Search,
    label: 'Research',
    key: 'research'
  },
  {
    icon: Scale,
    label: 'Compare',
    key: 'compare'
  },
  {
    icon: Newspaper,
    label: 'Latest',
    key: 'latest'
  },
  {
    icon: FileText,
    label: 'Summarize',
    key: 'summarize'
  },
  {
    icon: HelpCircle,
    label: 'Explain',
    key: 'explain'
  }
]

type ActiveView = SuggestionCategory | 'build' | null

interface ActionButtonsProps {
  onSelectPrompt: (prompt: string, category: SuggestionCategory) => void
  onCategoryClick: (category: string) => void
  onBuildTemplateSelect?: (prompt: string) => void
  promptSamples: Record<SuggestionCategory, string[]>
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  canvasEnabled?: boolean
  className?: string
}

export function ActionButtons({
  onSelectPrompt,
  onCategoryClick,
  onBuildTemplateSelect,
  promptSamples,
  inputRef,
  canvasEnabled = false,
  className
}: ActionButtonsProps) {
  const [activeView, setActiveView] = useState<ActiveView>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleCategoryClick = (category: ActionCategory) => {
    setActiveView(category.key)
    onCategoryClick(category.label)
  }

  const handleBuildClick = () => {
    setActiveView('build')
  }

  const handlePromptClick = (prompt: string) => {
    if (activeView && activeView !== 'build') {
      const category = activeView
      setActiveView(null)
      onSelectPrompt(prompt, category)
    }
  }

  const handleBuildTemplateClick = (template: BuildTemplate) => {
    setActiveView(null)
    onBuildTemplateSelect?.(template.prompt)
  }

  const resetToButtons = () => {
    setActiveView(null)
  }

  // Handle Escape key and clicks outside (including focus loss)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeView) {
        resetToButtons()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (activeView) {
          // Check if click is not on the input field
          if (!inputRef?.current?.contains(e.target as Node)) {
            resetToButtons()
          }
        }
      }
    }

    const handleFocusOut = () => {
      // Check if focus is moving outside both the container and input
      setTimeout(() => {
        const activeElement = document.activeElement
        if (
          activeView &&
          !containerRef.current?.contains(activeElement) &&
          activeElement !== inputRef?.current
        ) {
          resetToButtons()
        }
      }, FOCUS_OUT_DELAY_MS)
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [activeView, inputRef])

  const isBuildActive = activeView === 'build'
  const isSuggestionActive = activeView !== null && activeView !== 'build'

  const containerHeight = isBuildActive
    ? 'min-h-[180px] h-auto sm:h-[220px]'
    : 'min-h-[180px] h-auto sm:h-[180px]'

  // Total number of pills for stagger animation
  const buildPillIndex = actionCategories.length

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative transition-[height] duration-300',
        containerHeight,
        className
      )}
    >
      <div className="relative h-full">
        {/* Action buttons */}
        <div
          className={cn(
            'absolute inset-0 flex items-start justify-center pt-2 transition-opacity duration-300',
            activeView ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          <div className="flex flex-wrap justify-center gap-2 px-2">
            {actionCategories.map((category, index) => {
              const Icon = category.icon
              return (
                <Button
                  key={category.key}
                  type="button"
                  variant="outline"
                  size="default"
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-full animate-content-enter',
                    'min-h-11 text-xs sm:text-sm px-3 sm:px-4'
                  )}
                  style={
                    {
                      '--enter-delay': `${index * 60}ms`
                    } as React.CSSProperties
                  }
                  onClick={() => handleCategoryClick(category)}
                >
                  <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{category.label}</span>
                </Button>
              )
            })}
            {canvasEnabled && (
              <Button
                type="button"
                variant="outline"
                size="default"
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-full animate-content-enter',
                  'min-h-11 text-xs sm:text-sm px-3 sm:px-4'
                )}
                style={
                  {
                    '--enter-delay': `${buildPillIndex * 60}ms`
                  } as React.CSSProperties
                }
                onClick={handleBuildClick}
              >
                <Blocks className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Build</span>
              </Button>
            )}
          </div>
        </div>

        {/* Prompt samples (text suggestions) */}
        <div
          className={cn(
            'absolute inset-0 py-1 space-y-1 overflow-y-auto transition-opacity duration-300',
            !isSuggestionActive
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100'
          )}
        >
          {isSuggestionActive &&
            promptSamples[activeView]?.map((prompt, index) => (
              <button
                key={index}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2 min-h-11 rounded-md text-sm',
                  'hover:bg-muted transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'flex items-center gap-2 group'
                )}
                onClick={() => handlePromptClick(prompt)}
              >
                <Search className="h-3 w-3 text-muted-foreground flex-shrink-0 group-hover:text-foreground" />
                <span className="line-clamp-1">{prompt}</span>
              </button>
            ))}
        </div>

        {/* Build template cards */}
        <div
          className={cn(
            'absolute inset-0 py-2 px-1 transition-opacity duration-300',
            !isBuildActive ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          {isBuildActive && (
            <div className="grid grid-cols-3 gap-3">
              {BUILD_TEMPLATES.map(template => (
                <button
                  key={template.key}
                  type="button"
                  className="group flex flex-col gap-2 text-left min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
                  onClick={() => handleBuildTemplateClick(template)}
                >
                  <div className="relative aspect-[3/2] w-full rounded-xl overflow-hidden bg-muted/50 ring-1 ring-border/50 transition-all group-hover:ring-border group-hover:shadow-md">
                    <Image
                      src={template.thumbnail}
                      alt={template.label}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors px-1">
                    {template.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
