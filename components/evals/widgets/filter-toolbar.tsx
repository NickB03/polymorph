import type { WidgetProps } from './shared/widget-props'

export function FilterToolbar(_props: WidgetProps) {
  return (
    <div className="flex items-center justify-end gap-2 text-xs">
      {['All', 'Capability', 'Traffic Monitor'].map(label => (
        <button
          key={label}
          type="button"
          disabled
          className="rounded-md border border-border px-3 py-1.5 text-muted-foreground"
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        disabled
        className="rounded-md border border-border px-3 py-1.5 text-muted-foreground"
      >
        24h ▾
      </button>
    </div>
  )
}
