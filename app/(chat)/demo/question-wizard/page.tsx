'use client'

import { useState } from 'react'

import { QuestionWizard } from '@/components/tool-ui/question-wizard/question-wizard'
import type { WizardResult } from '@/components/tool-ui/question-wizard/schema'

const DEMO_STEPS = [
  {
    id: 'artifact-features',
    title: 'What features would you like?',
    description: 'Select the capabilities for your dashboard',
    selectionMode: 'multi' as const,
    minSelections: 1,
    maxSelections: 4,
    options: [
      {
        id: 'analytics',
        label: 'Real-time Analytics',
        description: 'Live charts and metrics that update automatically'
      },
      {
        id: 'tasks',
        label: 'Task Management',
        description: 'Kanban board with drag-and-drop'
      },
      {
        id: 'calendar',
        label: 'Calendar View',
        description: 'Schedule and timeline visualization'
      },
      {
        id: 'notifications',
        label: 'Notification Center',
        description: 'Activity feed with real-time alerts'
      },
      {
        id: 'search',
        label: 'Global Search',
        description: 'Full-text search across all content'
      }
    ]
  },
  {
    id: 'artifact-style',
    title: 'Choose a visual direction',
    description: 'Pick the look and feel for your dashboard',
    selectionMode: 'single' as const,
    options: [
      {
        id: 'minimal',
        label: 'Minimal & Clean',
        description: 'Lots of whitespace, subtle borders, muted palette'
      },
      {
        id: 'bold',
        label: 'Bold & Colorful',
        description: 'Vibrant accents, gradient backgrounds, strong contrast'
      },
      {
        id: 'dark-pro',
        label: 'Dark Pro',
        description: 'Dark theme, neon accents, developer-focused aesthetic'
      },
      {
        id: 'glassmorphism',
        label: 'Glassmorphism',
        description: 'Frosted glass panels, soft blurs, translucent layers'
      }
    ]
  },
  {
    id: 'artifact-layout',
    title: 'Preferred layout',
    selectionMode: 'single' as const,
    options: [
      {
        id: 'sidebar',
        label: 'Sidebar Navigation',
        description: 'Fixed sidebar with collapsible sections'
      },
      {
        id: 'topbar',
        label: 'Top Navigation',
        description: 'Horizontal nav bar with dropdown menus'
      },
      {
        id: 'tabs',
        label: 'Tabbed Interface',
        description: 'Content organized into switchable tab panels'
      }
    ]
  }
]

function DemoSection({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="flex justify-center rounded-xl border bg-background/50 p-8">
        {children}
      </div>
    </div>
  )
}

export default function QuestionWizardDemoPage() {
  const [submittedResult, setSubmittedResult] = useState<WizardResult | null>(
    null
  )
  const [receiptKey, setReceiptKey] = useState(0)

  const handleSubmit = (_actionId: string, result: WizardResult) => {
    setSubmittedResult(result)
    setReceiptKey(prev => prev + 1)
  }

  const handleReset = () => {
    setSubmittedResult(null)
    setReceiptKey(prev => prev + 1)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-12 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold">Question Wizard Demo</h1>
        <p className="text-muted-foreground mt-1">
          Paginated question card with step-by-step navigation
        </p>
      </div>

      {/* Interactive demo */}
      <DemoSection
        title="Interactive"
        description="Click through the steps, select options, and submit."
      >
        {submittedResult ? (
          <div className="flex flex-col items-center gap-6">
            <QuestionWizard
              key={`receipt-${receiptKey}`}
              id="demo-wizard-receipt"
              steps={DEMO_STEPS}
              choice={submittedResult}
            />
            <button
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors"
            >
              Reset and try again
            </button>
          </div>
        ) : (
          <QuestionWizard
            key={`interactive-${receiptKey}`}
            id="demo-wizard"
            steps={DEMO_STEPS}
            submitLabel="Build Dashboard"
            onAction={handleSubmit}
          />
        )}
      </DemoSection>

      {/* Pre-filled receipt */}
      <DemoSection
        title="Receipt State"
        description="How the card looks in chat history after submission."
      >
        <QuestionWizard
          id="demo-wizard-static-receipt"
          steps={DEMO_STEPS}
          choice={{
            'artifact-features': ['analytics', 'tasks', 'calendar'],
            'artifact-style': 'dark-pro',
            'artifact-layout': 'sidebar'
          }}
        />
      </DemoSection>

      {/* Two-step variant */}
      <DemoSection
        title="Two-Step Variant"
        description="The minimal case: just two questions (matching the artifact intake flow)."
      >
        <QuestionWizard
          id="demo-wizard-two-step"
          steps={DEMO_STEPS.slice(0, 2)}
          submitLabel="Create"
          onAction={(_id, result) => {
            console.log('Two-step result:', result)
          }}
        />
      </DemoSection>

      {submittedResult && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Submitted Result</h2>
          <pre className="bg-muted overflow-auto rounded-lg p-4 text-sm">
            {JSON.stringify(submittedResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
