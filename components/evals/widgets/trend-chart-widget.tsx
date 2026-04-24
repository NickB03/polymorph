'use client'

import { format } from 'date-fns'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import type { EvalTrendPoint } from '@/lib/evals/types'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'

const chartConfig = {
  overallScore: {
    label: 'Overall Score',
    color: 'var(--chart-1)'
  }
}

export function TrendChartInner({
  trend,
  height = 320
}: {
  trend: EvalTrendPoint[]
  height?: number
}) {
  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <AreaChart data={trend}>
        <defs>
          <linearGradient id="overallScore" x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-overallScore)"
              stopOpacity={0.4}
            />
            <stop
              offset="95%"
              stopColor="var(--color-overallScore)"
              stopOpacity={0.05}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="createdAt"
          tickFormatter={v => format(new Date(v), 'MMM d')}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={v => `${Math.round(Number(v) * 100)}%`}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={v => `${Math.round(Number(v) * 100)}%`}
              labelFormatter={v =>
                format(new Date(String(v)), 'MMM d, yyyy h:mm a')
              }
            />
          }
        />
        <Area
          type="monotone"
          dataKey="overallScore"
          stroke="var(--color-overallScore)"
          strokeWidth={2}
          fill="url(#overallScore)"
        />
      </AreaChart>
    </ChartContainer>
  )
}
