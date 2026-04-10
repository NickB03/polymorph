'use client'

import { format } from 'date-fns'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import type { EvalTrendPoint } from '@/lib/evals/types'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

export function TrendChart({ trend }: { trend: EvalTrendPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Capability Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[320px] w-full">
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
              tickFormatter={value => format(new Date(value), 'MMM d')}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={value => `${Math.round(Number(value) * 100)}%`}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={value => `${Math.round(Number(value) * 100)}%`}
                  labelFormatter={value =>
                    format(new Date(String(value)), 'MMM d, yyyy h:mm a')
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
      </CardContent>
    </Card>
  )
}
