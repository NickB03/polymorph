const EVALUATOR_LABELS = {
  deterministic_prechecks: 'Prechecks',
  tool_usage: 'Tool Usage',
  tool_selection: 'Tool Selection',
  faithfulness: 'Faithfulness',
  relevance: 'Relevance',
  response_quality: 'Response Quality',
  safety: 'Safety',
  citation_accuracy: 'Citation Accuracy'
} as const

const EVALUATOR_COLORS = {
  deterministic_prechecks: 'var(--chart-1)',
  tool_usage: 'var(--chart-2)',
  tool_selection: 'hsl(262 52% 47%)',
  faithfulness: 'var(--chart-3)',
  relevance: 'var(--chart-4)',
  response_quality: 'var(--chart-5)',
  safety: 'hsl(142 71% 45%)',
  citation_accuracy: 'hsl(32 95% 44%)'
} as const

function fallbackLabel(key: string) {
  return key
    .split('_')
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

export function getEvaluatorLabel(key: string) {
  return (
    EVALUATOR_LABELS[key as keyof typeof EVALUATOR_LABELS] ?? fallbackLabel(key)
  )
}

// Display order for evaluator grids. Mirrors the wireframe ordering:
// LLM judges first, deterministic auto-rules last. Safety is kept in the
// list (after the wire's six visible rows) for data integrity even though
// the wire doesn't show it.
export const EVALUATOR_DISPLAY_ORDER: Array<keyof typeof EVALUATOR_LABELS> = [
  'faithfulness',
  'response_quality',
  'citation_accuracy',
  'relevance',
  'deterministic_prechecks',
  'tool_usage',
  'tool_selection',
  'safety'
]

export function getEvaluatorColor(key: string) {
  return (
    EVALUATOR_COLORS[key as keyof typeof EVALUATOR_COLORS] ?? 'var(--chart-1)'
  )
}
