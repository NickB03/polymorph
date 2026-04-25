import {
  getEvaluatorColor,
  getEvaluatorLabel
} from '@/lib/evals/evaluator-labels'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function EvaluatorBars({
  evaluatorScores
}: {
  evaluatorScores: Record<string, number | null>
}) {
  const entries = Object.entries(evaluatorScores)
    .filter((entry): entry is [string, number] => entry[1] != null)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }

      return left[0].localeCompare(right[0])
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Evaluator Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map(([key, value]) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">
                {getEvaluatorLabel(key)}
              </span>
              <span className="text-sm font-medium tabular-nums">
                {Math.round(value * 100)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.max(0, Math.min(value, 1)) * 100}%`,
                  backgroundColor: getEvaluatorColor(key)
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
