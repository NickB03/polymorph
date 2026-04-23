'use client'

import { useEffect, useState } from 'react'

import type {
  BreakpointKey,
  EvalsLayoutTemplate,
  GridPosition
} from '@/lib/evals/layout/types'
import type { EvalsDashboardData } from '@/lib/evals/types'

import { EvalsEmptyState } from './empty-state'
import { WIDGET_REGISTRY } from './registry'

const ROW_HEIGHT_PX = 64
const ROW_GAP_PX = 16

function useBreakpoint(): BreakpointKey {
  const [bp, setBp] = useState<BreakpointKey>('lg')
  useEffect(() => {
    const lg = window.matchMedia('(min-width: 1024px)')
    const md = window.matchMedia('(min-width: 768px)')
    const update = () => {
      if (lg.matches) setBp('lg')
      else if (md.matches) setBp('md')
      else setBp('sm')
    }
    update()
    lg.addEventListener('change', update)
    md.addEventListener('change', update)
    return () => {
      lg.removeEventListener('change', update)
      md.removeEventListener('change', update)
    }
  }, [])
  return bp
}

function gridStyleFor(pos: GridPosition): React.CSSProperties {
  return {
    gridColumn: `${pos.x + 1} / span ${pos.w}`,
    gridRow: `${pos.y + 1} / span ${pos.h}`,
    minHeight: pos.h * ROW_HEIGHT_PX + (pos.h - 1) * ROW_GAP_PX
  }
}

export function LayoutRenderer({
  template,
  data
}: {
  template: EvalsLayoutTemplate
  data: EvalsDashboardData
}) {
  const bp = useBreakpoint()

  if (
    data.capability.latest === null &&
    data.regression.latest === null &&
    data.trafficMonitor.latest === null
  ) {
    return (
      <div data-testid="evals-empty-state-bypass" className="py-8">
        <EvalsEmptyState templateId={template.id} />
      </div>
    )
  }

  const positions = template.layouts[bp]
  const positionById = new Map(positions.map(p => [p.i, p]))

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gridAutoRows: `${ROW_HEIGHT_PX}px`
      }}
    >
      {template.items.map(item => {
        const pos = positionById.get(item.id)
        if (!pos) return null
        const Component = WIDGET_REGISTRY[item.type]
        return (
          <div
            key={item.id}
            data-widget-id={item.id}
            style={gridStyleFor(pos)}
            className="min-w-0"
          >
            <Component data={data} config={item.config ?? {}} breakpoint={bp} />
          </div>
        )
      })}
    </div>
  )
}
