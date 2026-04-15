'use client'

import { format } from 'date-fns'
import { LineChart as LineChartIcon } from 'lucide-react'
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
  const title = config.title ?? 'Trend · both suites overlaid'
  if (combined.length === 0) {
    return (
      <Card className="flex h-full flex-col border-dashed bg-muted/10">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="rounded-full border border-dashed border-muted-foreground/30 p-3 text-muted-foreground">
            <LineChartIcon aria-hidden className="h-5 w-5" />
          </div>
          <p className="max-w-sm text-xs text-muted-foreground">
            No trend data yet. Both suites need at least one run to overlay
            their history.
          </p>
        </CardContent>
      </Card>
    )
  }
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
