'use client'

import { memo, useCallback, useMemo } from 'react'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  cn
} from './_adapter'
import type { ChartProps } from './schema'

const DEFAULT_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
]

export const Chart = memo(function Chart({
  id,
  type,
  title,
  description,
  data,
  xKey,
  series,
  colors,
  showLegend = false,
  showGrid = true,
  className,
  onDataPointClick
}: ChartProps) {
  const palette = colors?.length ? colors : DEFAULT_COLORS

  const chartConfig: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        series.map((seriesItem, index) => [
          seriesItem.key,
          {
            label: seriesItem.label,
            color: seriesItem.color ?? palette[index % palette.length]
          }
        ])
      ),
    [series, palette]
  )

  const handleDataPointClick = useCallback(
    (
      seriesKey: string,
      seriesLabel: string,
      payload: Record<string, unknown>,
      index: number
    ) => {
      onDataPointClick?.({
        seriesKey,
        seriesLabel,
        xValue: payload[xKey],
        yValue: payload[seriesKey],
        index,
        payload
      })
    },
    [onDataPointClick, xKey]
  )

  const ChartComponent = type === 'bar' ? BarChart : LineChart

  const chartContent = (
    <ChartContainer
      config={chartConfig}
      className="min-h-[200px] w-full"
      data-tool-ui-id={id}
    >
      <ChartComponent data={data} accessibilityLayer>
        {showGrid && <CartesianGrid vertical={false} />}
        <XAxis
          dataKey={xKey}
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={10} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {showLegend && (
          <ChartLegend
            content={<ChartLegendContent payload={[] as never[]} />}
          />
        )}

        {type === 'bar' &&
          series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={chartConfig[s.key].color}
              radius={4}
              onClick={(data: any) =>
                handleDataPointClick(s.key, s.label, data.payload, data.index)
              }
              cursor={onDataPointClick ? 'pointer' : undefined}
            />
          ))}

        {type === 'line' &&
          series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              type="monotone"
              stroke={chartConfig[s.key].color}
              strokeWidth={2}
              dot={{ r: 4, cursor: onDataPointClick ? 'pointer' : undefined }}
              activeDot={{
                r: 6,
                cursor: onDataPointClick ? 'pointer' : undefined,
                // Recharts types are incorrect - onClick receives (event, dotData) at runtime

                onClick: ((_: unknown, dotData: any) => {
                  handleDataPointClick(
                    s.key,
                    s.label,
                    dotData.payload,
                    dotData.index
                  )
                }) as any
              }}
            />
          ))}
      </ChartComponent>
    </ChartContainer>
  )

  return (
    <Card
      className={cn('w-full min-w-80', className)}
      data-tool-ui-id={id}
      data-slot="chart"
    >
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle className="text-pretty">{title}</CardTitle>}
          {description && (
            <CardDescription className="text-pretty">
              {description}
            </CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent>{chartContent}</CardContent>
    </Card>
  )
})
