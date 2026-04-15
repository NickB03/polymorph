'use client'

import { format } from 'date-fns'
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from 'recharts'

import { buildCombinedTrend } from '@/lib/evals/helpers/combined-trend'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'

import type { WidgetProps } from './shared/widget-props'

type Config = {
  title?: string
}

export function CombinedTrendChart({ data, config }: WidgetProps<Config>) {
  const combined = buildCombinedTrend(data)
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">
          {config.title ?? 'Trend · both suites overlaid'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            capability: { label: 'Capability', color: 'var(--chart-1)' },
            trafficMonitor: {
              label: 'Traffic Monitor',
              color: 'var(--chart-3)'
            }
          }}
          className="h-[280px] w-full"
        >
          <LineChart data={combined}>
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
                    format(new Date(String(v)), 'MMM d, h:mm a')
                  }
                />
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="capability"
              stroke="var(--color-capability)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="trafficMonitor"
              stroke="var(--color-trafficMonitor)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
