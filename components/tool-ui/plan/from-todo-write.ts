import type { TodoItem } from '@/lib/types/ai'

import type { PlanProps, PlanTodo, PlanTodoStatus } from './schema'

export interface TodoWriteOutput {
  todos?: TodoItem[]
  message?: string
  completedCount?: number
  totalCount?: number
}

const STATUS_MAP: Record<string, PlanTodoStatus> = {
  pending: 'pending',
  in_progress: 'in_progress',
  completed: 'completed'
}

/**
 * Normalize a status string into a PlanTodoStatus.
 *
 * @param status - The source status string to map (may be undefined or unrecognized)
 * @returns The corresponding PlanTodoStatus; `'pending'` if `status` is undefined or not recognized
 */
function toStatus(status: string | undefined): PlanTodoStatus {
  return STATUS_MAP[status ?? ''] ?? 'pending'
}

/**
 * Convert a TodoItem into a PlanTodo suitable for inclusion in a plan.
 *
 * @param item - The source todo item to convert
 * @param index - Index used to generate a fallback id when `item.id` is missing
 * @returns A PlanTodo whose `id` is `item.id` or `todo-{index}`, `label` is the todo content, and `status` is the item's status mapped to a `PlanTodoStatus`
 */
function toPlanTodo(item: TodoItem, index: number): PlanTodo {
  return {
    id: item.id ?? `todo-${index}`,
    label: item.content,
    status: toStatus(item.status)
  }
}

/**
 * Produce a PlanProps for a "Research Plan" from a TodoWriteOutput, or null when the input has no todos.
 *
 * @param output - The source todo write output whose `message` becomes the plan description and whose `todos` are converted into plan todos
 * @returns A PlanProps representing the research plan, or `null` if `output.todos` is missing or an empty array
 */
export function mapTodoWriteToPlan(output: TodoWriteOutput): PlanProps | null {
  const todos = output.todos
  if (!todos || todos.length === 0) return null

  return {
    id: 'research-plan',
    title: 'Research Plan',
    description: output.message,
    todos: todos.map(toPlanTodo)
  }
}
