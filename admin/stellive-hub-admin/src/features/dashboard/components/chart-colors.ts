export const DELIVERY_COLORS = {
  sent: 'var(--chart-2)',
  queued: 'var(--chart-4)',
  skipped: 'var(--muted-foreground)',
  failed: 'var(--destructive)',
} as const

const SOURCE_COLORS: Record<string, string> = {
  youtube: 'var(--chart-1)',
  chzzk: 'var(--chart-2)',
  fcm: 'var(--chart-3)',
  websub: 'var(--chart-4)',
  other: 'var(--chart-5)',
}

export function sourceColor(source: string): string {
  return SOURCE_COLORS[source] ?? SOURCE_COLORS.other
}

export const CHART_AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--muted-foreground)', fontSize: 11 },
} as const
