'use client'

import { Line, LineChart } from 'recharts'

import type { EvalTrendPoint } from '@/lib/evals/types'

import { ChartContainer } from '@/components/ui/chart'

export function Sparkline({
  trend,
  color
}: {
  trend: EvalTrendPoint[]
  color: string
}) {
  return (
    <ChartContainer
      config={{ overallScore: { label: 'Score', color } }}
      className="h-10 w-full"
    >
      <LineChart data={trend}>
        <Line
          type="monotone"
          dataKey="overallScore"
          stroke={color}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
