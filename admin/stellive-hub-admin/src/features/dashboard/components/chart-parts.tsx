import { type ReactNode } from 'react'

export function LegendDot({ color }: { color: string }) {
  return (
    <i
      aria-hidden='true'
      className='inline-block size-2.5 rounded-full'
      style={{ backgroundColor: color }}
    />
  )
}

export function ChartLegend({
  items,
  label,
}: {
  items: { key: string; label: string; color: string }[]
  label: string
}) {
  return (
    <div
      aria-label={label}
      className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'
    >
      {items.map((item) => (
        <span key={item.key} className='inline-flex items-center gap-1.5'>
          <LegendDot color={item.color} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

/** Popover-styled tooltip body shared by both charts. */
export function ChartTooltipBox({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className='min-w-40 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md'>
      <div className='mb-1 font-medium'>{title}</div>
      <div className='space-y-1'>{children}</div>
    </div>
  )
}

export function ChartTooltipRow({
  color,
  label,
  value,
  strong,
}: {
  color?: string
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className='flex items-center justify-between gap-4'>
      <span className='inline-flex items-center gap-1.5 text-muted-foreground'>
        {color ? <LegendDot color={color} /> : null}
        {label}
      </span>
      <span className={strong ? 'font-semibold' : 'font-medium tabular-nums'}>
        {value}
      </span>
    </div>
  )
}
