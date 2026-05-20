'use client'

import { scaleLinear, scaleTime } from '@visx/scale'
import { bisector } from 'd3-array'
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'
import { ChartProvider, type LineConfig, type Margin } from './chart-context'
import { useChartInteraction } from './use-chart-interaction'

function isDefsComponent(child: ReactElement): boolean {
  const displayName =
    (child.type as { displayName?: string })?.displayName ||
    (child.type as { name?: string })?.name ||
    ''
  return (
    displayName.includes('Gradient') ||
    displayName.includes('Pattern') ||
    displayName === 'LinearGradient' ||
    displayName === 'RadialGradient'
  )
}

/** Markers render after the interaction overlay so they stay clickable. */
export function isPostOverlayComponent(child: ReactElement): boolean {
  const childType = child.type as {
    displayName?: string
    name?: string
    __isChartMarkers?: boolean
  }

  if (childType.__isChartMarkers) {
    return true
  }

  const componentName =
    typeof child.type === 'function'
      ? childType.displayName || childType.name || ''
      : ''

  return componentName === 'ChartMarkers' || componentName === 'MarkerGroup'
}

export interface TimeSeriesChartInnerProps {
  width: number
  height: number
  data: Record<string, unknown>[]
  xDataKey: string
  margin: Margin
  animationDuration: number
  children: ReactNode
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Series keys driving y-domain and tooltip (Line / Area / SeriesBar configs). */
  lines: LineConfig[]
  /** SVG clipPath id for grow animation. */
  clipPathId: string
  /** Optional ComposedChart bar layout (forwarded into context). */
  composedBarDataKeys?: string[]
  composedBarSize?: number
  composedMaxBarSize?: number
  composedBarGap?: number
  composedStacked?: boolean
  composedStackOffsets?: Map<number, Map<string, number>>
  composedStackGap?: number
  /** When set, drives the y-axis max instead of scanning `lines` (e.g. stacked bar totals). */
  yScaleDomainMax?: number
}

export function TimeSeriesChartInner({
  width,
  height,
  data,
  xDataKey,
  margin,
  animationDuration,
  children,
  containerRef,
  lines,
  clipPathId,
  composedBarDataKeys,
  composedBarSize,
  composedMaxBarSize,
  composedBarGap,
  composedStacked,
  composedStackOffsets,
  composedStackGap,
  yScaleDomainMax
}: TimeSeriesChartInnerProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const xAccessor = useCallback(
    (d: Record<string, unknown>): Date => {
      const value = d[xDataKey]
      return value instanceof Date ? value : new Date(value as string | number)
    },
    [xDataKey]
  )

  const bisectDate = useMemo(
    () => bisector<Record<string, unknown>, Date>(d => xAccessor(d)).left,
    [xAccessor]
  )

  const xScale = useMemo(() => {
    const dates = data.map(d => xAccessor(d))
    const minTime = Math.min(...dates.map(d => d.getTime()))
    const maxTime = Math.max(...dates.map(d => d.getTime()))

    return scaleTime({
      range: [0, innerWidth],
      domain: [minTime, maxTime]
    })
  }, [innerWidth, data, xAccessor])

  const columnWidth = useMemo(() => {
    if (data.length < 2) {
      return 0
    }
    return innerWidth / (data.length - 1)
  }, [innerWidth, data.length])

  const yScale = useMemo(() => {
    let maxValue = 0
    if (yScaleDomainMax != null && yScaleDomainMax > 0) {
      maxValue = yScaleDomainMax
    } else {
      for (const line of lines) {
        for (const d of data) {
          const value = d[line.dataKey]
          if (typeof value === 'number' && value > maxValue) {
            maxValue = value
          }
        }
      }

      if (maxValue === 0) {
        maxValue = 100
      }
    }

    return scaleLinear({
      range: [innerHeight, 0],
      domain: [0, maxValue * 1.1],
      nice: true
    })
  }, [innerHeight, data, lines, yScaleDomainMax])

  const dateLabels = useMemo(
    () =>
      data.map(d =>
        xAccessor(d).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      ),
    [data, xAccessor]
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, animationDuration)
    return () => clearTimeout(timer)
  }, [animationDuration])

  const canInteract = isLoaded

  const {
    tooltipData,
    setTooltipData,
    selection,
    clearSelection,
    interactionHandlers,
    interactionStyle
  } = useChartInteraction({
    xScale,
    yScale,
    data,
    lines,
    margin,
    xAccessor,
    bisectDate,
    canInteract
  })

  if (width < 10 || height < 10) {
    return null
  }

  const defsChildren: ReactElement[] = []
  const preOverlayChildren: ReactElement[] = []
  const postOverlayChildren: ReactElement[] = []

  Children.forEach(children, child => {
    if (!isValidElement(child)) {
      return
    }

    if (isDefsComponent(child)) {
      defsChildren.push(child)
    } else if (isPostOverlayComponent(child)) {
      postOverlayChildren.push(child)
    } else {
      preOverlayChildren.push(child)
    }
  })

  const contextValue = {
    data,
    xScale,
    yScale,
    width,
    height,
    innerWidth,
    innerHeight,
    margin,
    columnWidth,
    tooltipData,
    setTooltipData,
    containerRef,
    lines,
    isLoaded,
    animationDuration,
    xAccessor,
    dateLabels,
    selection,
    clearSelection,
    composedBarDataKeys,
    composedBarSize,
    composedMaxBarSize,
    composedBarGap,
    composedStacked,
    composedStackOffsets,
    composedStackGap
  }

  return (
    <ChartProvider value={contextValue}>
      <svg aria-hidden="true" height={height} width={width}>
        <defs>
          <clipPath id={clipPathId}>
            <rect
              height={innerHeight + 20}
              style={{
                transition: isLoaded
                  ? 'none'
                  : `width ${animationDuration}ms cubic-bezier(0.85, 0, 0.15, 1)`
              }}
              width={isLoaded ? innerWidth : 0}
              x={0}
              y={0}
            />
          </clipPath>
          {defsChildren}
        </defs>

        <rect fill="transparent" height={height} width={width} x={0} y={0} />

        <g
          {...interactionHandlers}
          style={interactionStyle}
          transform={`translate(${margin.left},${margin.top})`}
        >
          <rect
            fill="transparent"
            height={innerHeight}
            width={innerWidth}
            x={0}
            y={0}
          />

          {preOverlayChildren}
          {postOverlayChildren}
        </g>
      </svg>
    </ChartProvider>
  )
}
