'use client'

import { Fragment, useCallback, useMemo, useState } from 'react'

import { ArrowLeft, ArrowRight, Check, Send } from 'lucide-react'

import { OptionList } from '../option-list/option-list'
import type { OptionListSelection } from '../option-list/schema'

import { Button, cn, Separator } from './_adapter'
import type { QuestionWizardProps, WizardResult, WizardStep } from './schema'

function StepDots({
  steps,
  current,
  answers
}: {
  steps: WizardStep[]
  current: number
  answers: WizardResult
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      aria-hidden="true"
      role="presentation"
    >
      {steps.map((step, i) => {
        const isActive = i === current
        const isCompleted = i < current || (step.id in answers && !isActive)
        return (
          <div
            key={i}
            className={cn(
              'size-1.5 rounded-full transition-all duration-300',
              isActive && 'bg-primary scale-125',
              isCompleted && !isActive && 'bg-primary/50',
              !isActive && !isCompleted && 'bg-border'
            )}
          />
        )
      })}
    </div>
  )
}

function WizardReceipt({
  id,
  steps,
  answers,
  className
}: {
  id: string
  steps: WizardStep[]
  answers: WizardResult
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex w-full max-w-md flex-col',
        'text-foreground',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:blur-in-sm motion-safe:zoom-in-95 motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:fill-mode-both',
        className
      )}
      data-slot="question-wizard"
      data-tool-ui-id={id}
      data-receipt="true"
      role="status"
      aria-label="Confirmed selections"
    >
      <div className="bg-card/60 flex w-full flex-col overflow-hidden rounded-xl border shadow-xs">
        {steps.map((step, stepIndex) => {
          const selection = answers[step.id]
          const selectedIds = new Set(
            selection == null
              ? []
              : typeof selection === 'string'
                ? [selection]
                : selection
          )
          const confirmedOptions = step.options.filter(opt =>
            selectedIds.has(opt.id)
          )

          return (
            <Fragment key={step.id}>
              {stepIndex > 0 && <Separator orientation="horizontal" />}
              <div className="flex flex-col gap-1 px-5 py-3">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {step.title}
                </span>
                {confirmedOptions.length > 0 ? (
                  <div className="flex flex-col">
                    {confirmedOptions.map((option, optIndex) => (
                      <div
                        key={option.id}
                        className="flex items-start gap-2.5 py-0.5"
                        style={
                          {
                            '--enter-delay': `${(stepIndex * 2 + optIndex) * 50}ms`
                          } as React.CSSProperties
                        }
                      >
                        <span className="flex h-6 items-center">
                          <Check className="text-primary size-3.5 shrink-0" />
                        </span>
                        <span className="text-sm leading-6 font-medium text-pretty">
                          {option.label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm italic">
                    No selection
                  </span>
                )}
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

function selectionCount(selection: OptionListSelection): number {
  if (selection == null) return 0
  if (typeof selection === 'string') return 1
  return selection.length
}

export function QuestionWizard({
  id,
  steps,
  submitLabel = 'Submit',
  choice,
  onAction,
  className
}: QuestionWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<WizardResult>({})
  const [transition, setTransition] = useState<'forward' | 'backward' | null>(
    null
  )

  const isReceipt = choice !== undefined && choice !== null
  const step = steps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1
  const totalSteps = steps.length

  const currentSelection = answers[step?.id ?? ''] ?? null
  const currentMin = step?.minSelections ?? 1
  const canAdvance = selectionCount(currentSelection) >= currentMin

  const goToStep = useCallback(
    (nextIndex: number) => {
      setTransition(nextIndex > currentStep ? 'forward' : 'backward')
      // Brief transition out, then swap step
      setTimeout(() => {
        setCurrentStep(nextIndex)
        setTransition(null)
      }, 200)
    },
    [currentStep]
  )

  const handleNext = useCallback(() => {
    if (!isLastStep && canAdvance) {
      goToStep(currentStep + 1)
    }
  }, [canAdvance, currentStep, goToStep, isLastStep])

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      goToStep(currentStep - 1)
    }
  }, [currentStep, goToStep, isFirstStep])

  const handleSubmit = useCallback(async () => {
    if (!canAdvance) return
    await onAction?.('confirm', answers)
  }, [answers, canAdvance, onAction])

  // Convert each step's options to OptionList-compatible format
  const stepsWithOptions = useMemo(
    () =>
      steps.map(s => ({
        ...s,
        listOptions: s.options.map(opt => ({
          id: opt.id,
          label: opt.label,
          description: opt.description,
          disabled: opt.disabled
        }))
      })),
    [steps]
  )

  if (isReceipt) {
    return (
      <WizardReceipt
        id={id}
        steps={steps}
        answers={choice}
        className={className}
      />
    )
  }

  if (!step) return null

  return (
    <div
      className={cn(
        'flex w-full max-w-md flex-col gap-3',
        'text-foreground',
        className
      )}
      data-slot="question-wizard"
      data-tool-ui-id={id}
      role="group"
      aria-label="Question wizard"
      aria-describedby={`${id}-step-title`}
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex flex-col gap-0.5">
          <span
            id={`${id}-step-title`}
            className="text-sm font-semibold leading-tight"
          >
            {step.title}
          </span>
          {step.description && (
            <span className="text-muted-foreground text-xs leading-snug text-pretty">
              {step.description}
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-muted-foreground text-xs tabular-nums">
            {currentStep + 1} / {totalSteps}
          </span>
          <StepDots steps={steps} current={currentStep} answers={answers} />
        </div>
      </div>

      {/* All steps rendered in a stacked grid so the tallest sets container height */}
      <div
        className="grid overflow-hidden"
        style={{ gridTemplate: '1fr / 1fr' }}
      >
        {stepsWithOptions.map((s, i) => {
          const isActive = i === currentStep
          const isLeaving = transition !== null && isActive
          const isHidden = !isActive

          return (
            <div
              key={s.id}
              className={cn(
                'col-start-1 row-start-1',
                'transition-all duration-200 ease-out',
                'motion-safe:transition-all',
                isHidden && 'pointer-events-none invisible opacity-0',
                isLeaving &&
                  transition === 'forward' &&
                  'pointer-events-none motion-safe:-translate-x-2 motion-safe:opacity-0',
                isLeaving &&
                  transition === 'backward' &&
                  'pointer-events-none motion-safe:translate-x-2 motion-safe:opacity-0',
                isActive &&
                  !transition &&
                  'motion-safe:translate-x-0 motion-safe:opacity-100'
              )}
              aria-hidden={isHidden}
            >
              <OptionList
                id={`${id}-step-${s.id}`}
                options={s.listOptions}
                selectionMode={s.selectionMode ?? 'multi'}
                minSelections={s.minSelections}
                maxSelections={s.maxSelections}
                value={answers[s.id] ?? null}
                onChange={selection => {
                  setAnswers(prev => ({ ...prev, [s.id]: selection }))
                }}
              />
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          {!isFirstStep && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-1.5 rounded-full px-3"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
          )}
        </div>
        <div>
          {isLastStep ? (
            <Button
              variant="default"
              size="sm"
              onClick={handleSubmit}
              disabled={!canAdvance}
              className="gap-1.5 rounded-full px-4"
            >
              {submitLabel}
              <Send className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleNext}
              disabled={!canAdvance}
              className="gap-1.5 rounded-full px-4"
            >
              Next
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
