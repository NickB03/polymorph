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
