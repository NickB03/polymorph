const EVALUATOR_LABELS = {
  deterministic_prechecks: 'Eligibility Checks',
  tool_usage: 'Tool Usage Quality',
  faithfulness: 'Groundedness',
  relevance: 'Relevance',
  response_quality: 'Answer Quality',
  safety: 'Safety',
  citation_accuracy: 'Citation Correctness'
} as const

const EVALUATOR_COLORS = {
  deterministic_prechecks: 'var(--chart-1)',
  tool_usage: 'var(--chart-2)',
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

// Display order for evaluator grids. Intentionally differs from the
// insertion order of EVALUATOR_LABELS (which leads with deterministic checks).
export const EVALUATOR_DISPLAY_ORDER: Array<keyof typeof EVALUATOR_LABELS> = [
  'faithfulness',
  'relevance',
  'safety',
  'response_quality',
  'citation_accuracy',
  'tool_usage',
  'deterministic_prechecks'
]

export function getEvaluatorColor(key: string) {
  return (
    EVALUATOR_COLORS[key as keyof typeof EVALUATOR_COLORS] ?? 'var(--chart-1)'
  )
}
