'use client'

import { useState } from 'react'

import { Check } from 'lucide-react'

import { Plan } from './tool-ui/plan'
import type { TodoWriteOutput } from './tool-ui/plan/from-todo-write'
import { mapTodoWriteToPlan } from './tool-ui/plan/from-todo-write'
import type { PlanTodo } from './tool-ui/plan/schema'
import { safeParseSerializablePlan } from './tool-ui/plan/schema'
import { CollapsibleMessage } from './collapsible-message'
import { ProcessHeader } from './process-header'

interface ResearchPlanProps {
  output: TodoWriteOutput | undefined
  isStreaming: boolean
  hasError?: boolean
  completedToolCalls?: number
  hasActiveToolCall?: boolean
  isComplete?: boolean
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
  hasActiveToolCall,
  isComplete
}: ResearchPlanProps) {
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null)

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

  const isAllComplete = validated.todos.every(t => t.status === 'completed')
  const autoCollapsed = isAllComplete && (isComplete ?? false)
  const isOpen = userExpanded ?? !autoCollapsed

  if (isAllComplete) {
    const completedCount = validated.todos.length
    const header = (
      <ProcessHeader
        label={
          <span className="flex items-center gap-2">
            <Check className="size-3.5 shrink-0 text-emerald-500" />
            <span className="truncate">
              {validated.title} &mdash; {completedCount}/
              {validated.todos.length} complete
            </span>
          </span>
        }
      />
    )

    return (
      <div className="my-2">
        <CollapsibleMessage
          role="assistant"
          isCollapsible
          header={header}
          isOpen={isOpen}
          onOpenChange={open => setUserExpanded(open)}
          showIcon={false}
          showBorder
          variant="default"
          showSeparator={false}
        >
          <Plan {...validated} />
        </CollapsibleMessage>
      </div>
    )
  }

  return (
    <div className="my-2">
      <Plan {...validated} />
    </div>
  )
}
