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

function toStatus(status: string | undefined): PlanTodoStatus {
  return STATUS_MAP[status ?? ''] ?? 'pending'
}

function toPlanTodo(item: TodoItem, index: number): PlanTodo {
  return {
    id: item.id ?? `todo-${index}`,
    label: item.content,
    status: toStatus(item.status)
  }
}

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
