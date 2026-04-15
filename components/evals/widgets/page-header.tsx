import { formatDistanceToNow } from 'date-fns'

import type { WidgetProps } from './shared/widget-props'

type Config = {
  title?: string
  subtitle?: 'lastSync' | 'bothSuites' | string
}

export function PageHeader({ data, config }: WidgetProps<Config>) {
  const title = config.title ?? 'Evals'
  const subtitle = renderSubtitle(data, config.subtitle)
  return (
    <div className="flex flex-col justify-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle ? (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  )
}

function renderSubtitle(
  data: WidgetProps<Config>['data'],
  mode: Config['subtitle']
): string | null {
  if (mode === 'lastSync') {
    const iso = data.trafficMonitor.lastUpdated
    if (!iso) return null
    return `Last sync ${formatDistanceToNow(new Date(iso), { addSuffix: true })}`
  }
  if (mode === 'bothSuites') {
    const c = data.capability.lastUpdated
    const t = data.trafficMonitor.lastUpdated
    if (!c && !t) return null
    const bits: string[] = []
    if (c)
      bits.push(
        `Capability ${formatDistanceToNow(new Date(c), { addSuffix: true })}`
      )
    if (t)
      bits.push(
        `Traffic Monitor ${formatDistanceToNow(new Date(t), { addSuffix: true })}`
      )
    return bits.join(' · ')
  }
  return typeof mode === 'string' ? mode : null
}
