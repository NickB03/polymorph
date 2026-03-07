'use client'

import { Plan } from './tool-ui/plan'
import type { TodoWriteOutput } from './tool-ui/plan/from-todo-write'
import { mapTodoWriteToPlan } from './tool-ui/plan/from-todo-write'
import type { PlanTodo } from './tool-ui/plan/schema'
import { safeParseSerializablePlan } from './tool-ui/plan/schema'

interface ResearchPlanProps {
  output: TodoWriteOutput | undefined
  isStreaming: boolean
  hasError?: boolean
  completedToolCalls?: number
  hasActiveToolCall?: boolean
}

/**
 * Infer progress from completed research tool calls in the stream.
 * Maps tool completions proportionally onto plan tasks, capping at N-1
 * so the final "all complete" always comes from the model's explicit finalize.
 */
function inferTodoProgress(
  todos: PlanTodo[],
  completedToolCalls: number,
  hasActiveToolCall: boolean
): PlanTodo[] {
  const modelCompleted = todos.filter(t => t.status === 'completed').length
  if (modelCompleted === todos.length) return todos

  const inferredCompleted = Math.min(completedToolCalls, todos.length - 1)

  return todos.map((todo, index) => {
    if (todo.status === 'completed') return todo
    if (index < inferredCompleted)
      return { ...todo, status: 'completed' as const }
    if (index === inferredCompleted && hasActiveToolCall)
      return { ...todo, status: 'in_progress' as const }
    return todo
  })
}

export function ResearchPlan({
  output,
  isStreaming,
  hasError,
  completedToolCalls,
  hasActiveToolCall
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

  // Enrich with inferred progress from tool call stream
  if (completedToolCalls !== undefined && completedToolCalls > 0) {
    planProps.todos = inferTodoProgress(
      planProps.todos,
      completedToolCalls,
      hasActiveToolCall ?? false
    )
  }

  // Validate through schema for runtime safety (e.g. duplicate ID check)
  const validated = safeParseSerializablePlan(planProps)
  if (!validated) return null

  return (
    <div className="my-2">
      <Plan {...validated} />
    </div>
  )
}
