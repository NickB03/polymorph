'use client'

import { Plan } from './tool-ui/plan'
import type { TodoWriteOutput } from './tool-ui/plan/from-todo-write'
import { mapTodoWriteToPlan } from './tool-ui/plan/from-todo-write'
import { safeParseSerializablePlan } from './tool-ui/plan/schema'

interface ResearchPlanProps {
  output: TodoWriteOutput | undefined
  isStreaming: boolean
  hasError?: boolean
}

/**
 * Render a research plan UI based on the provided output and the current loading/error state.
 *
 * @param output - The optional TodoWriteOutput to map and validate into Plan props; when present and valid, its plan is rendered.
 * @param isStreaming - When `true` and `output` is undefined, a pulsing loading placeholder is shown.
 * @param hasError - When `true` and `output` is undefined (and not streaming), an error message is shown.
 * @returns A JSX element displaying the validated Plan, a loading placeholder, an error message, or `null` if nothing should be rendered.
 */
export function ResearchPlan({
  output,
  isStreaming,
  hasError
}: ResearchPlanProps) {
  if (!output && isStreaming) {
    return (
      <div
        className="my-2 h-24 animate-pulse rounded-lg bg-muted"
        role="status"
        aria-label="Loading research plan"
      />
    )
  }

  if (!output) {
    if (hasError) {
      return (
        <div className="my-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Research plan could not be loaded
        </div>
      )
    }
    return null
  }

  const planProps = mapTodoWriteToPlan(output)
  if (!planProps) return null

  // Validate through schema for runtime safety (e.g. duplicate ID check)
  const validated = safeParseSerializablePlan(planProps)
  if (!validated) return null

  return (
    <div className="my-2">
      <Plan {...validated} />
    </div>
  )
}
