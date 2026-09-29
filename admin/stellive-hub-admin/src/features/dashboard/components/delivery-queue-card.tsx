import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import { intlLocale, useLocale, useT } from '@/lib/i18n'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  formatNumber,
  formatPercent,
  numericValue,
  shortDateLabel,
} from '../format'
import { type DailyDeliveryQueueTrend } from '../types'
import { CHART_AXIS_PROPS, DELIVERY_COLORS } from './chart-colors'
import { ChartLegend, ChartTooltipBox, ChartTooltipRow } from './chart-parts'
import { SummaryTile } from './summary-tile'

type Datum = {
  date: string
  label: string
  sent: number
  queued: number
  skipped: number
  failed: number
  total: number
}

export function DeliveryQueueCard({
  trend,
}: {
  trend: DailyDeliveryQueueTrend | undefined
}) {
  const t = useT()
  const { locale } = useLocale()
  const intl = intlLocale(locale)
  const items = trend && Array.isArray(trend.items) ? trend.items : []
  const totals = trend?.totals ?? {
    sent: 0,
    queued: 0,
    skipped: 0,
    failed: 0,
    total: 0,
  }
  const data: Datum[] = items.map((item) => ({
    date: item.date,
    label: shortDateLabel(item.date, intl),
    sent: numericValue(item.sent),
    queued: numericValue(item.queued),
    skipped: numericValue(item.skipped),
    failed: numericValue(item.failed),
    total: numericValue(item.total),
  }))
  const today = data[data.length - 1]
  const peak = data.reduce<Datum | undefined>(
    (best, item) => (!best || item.total > best.total ? item : best),
    undefined
  )
  const fmt = (value: number) => formatNumber(value, intl)
  const legend = [
    { key: 'sent', label: t('status.sent'), color: DELIVERY_COLORS.sent },
    { key: 'queued', label: t('status.queued'), color: DELIVERY_COLORS.queued },
    {
      key: 'skipped',
      label: t('status.skipped'),
      color: DELIVERY_COLORS.skipped,
    },
    { key: 'failed', label: t('status.failed'), color: DELIVERY_COLORS.failed },
  ]
  const barLabel = (item: Datum) =>
    t('dashboard.queueBarLabel', {
      date: item.date,
      sent: fmt(item.sent),
      queued: fmt(item.queued),
      skipped: fmt(item.skipped),
      failed: fmt(item.failed),
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.deliveryQueue')}</CardTitle>
        <CardDescription>
          {t('dashboard.deliveryQueueDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]'>
        <div className='min-w-0 space-y-3'>
          {data.length === 0 ? (
            <div className='flex h-56 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground'>
              {t('dashboard.noDelivery')}
            </div>
          ) : (
            <div role='img' aria-label={t('dashboard.queueChartLabel')}>
              <ResponsiveContainer width='100%' height={224}>
                <BarChart data={data} margin={{ top: 4, right: 4, left: -16 }}>
                  <CartesianGrid
                    vertical={false}
                    stroke='var(--border)'
                    strokeDasharray='3 3'
                  />
                  <XAxis
                    dataKey='label'
                    interval='preserveStartEnd'
                    {...CHART_AXIS_PROPS}
                  />
                  <YAxis allowDecimals={false} {...CHART_AXIS_PROPS} />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
                    content={({ active, payload }: TooltipContentProps) => {
                      const item = payload?.[0]?.payload as Datum | undefined
                      if (!active || !item) return null
                      return (
                        <ChartTooltipBox title={item.date}>
                          {legend.map((entry) => (
                            <ChartTooltipRow
                              key={entry.key}
                              color={entry.color}
                              label={entry.label}
                              value={fmt(
                                item[entry.key as keyof Datum] as number
                              )}
                            />
                          ))}
                        </ChartTooltipBox>
                      )
                    }}
                  />
                  <Bar
                    dataKey='sent'
                    stackId='a'
                    fill={DELIVERY_COLORS.sent}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey='queued'
                    stackId='a'
                    fill={DELIVERY_COLORS.queued}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey='skipped'
                    stackId='a'
                    fill={DELIVERY_COLORS.skipped}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey='failed'
                    stackId='a'
                    fill={DELIVERY_COLORS.failed}
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
              <ul className='sr-only'>
                {data.map((item) => (
                  <li key={item.date}>{barLabel(item)}</li>
                ))}
              </ul>
            </div>
          )}
          <ChartLegend items={legend} label={t('dashboard.deliveryQueue')} />
        </div>
        <div className='grid grid-cols-2 gap-3 self-start lg:grid-cols-1'>
          {data.length === 0 || !today || !peak ? (
            <>
              <SummaryTile
                label={t('dashboard.daysTotal', { days: 14 })}
                value={0}
                hint={t('dashboard.noDeliveryHint')}
              />
              <SummaryTile
                label={t('dashboard.failureRate')}
                value='0%'
                hint={t('dashboard.failureRateHint')}
              />
            </>
          ) : (
            <>
              <SummaryTile
                label={t('dashboard.todaySent')}
                value={today.sent}
                hint={t('dashboard.todaySentHint')}
              />
              <SummaryTile
                label={t('dashboard.todayFailed')}
                value={today.failed}
                hint={t('dashboard.todayFailedHint')}
              />
              <SummaryTile
                label={t('dashboard.daysTotal', {
                  days: trend?.days || data.length,
                })}
                value={numericValue(totals.total)}
                hint={t('dashboard.daysTotalHint')}
              />
              <SummaryTile
                label={t('dashboard.failureRate')}
                value={formatPercent(totals.failed, totals.total)}
                hint={t('dashboard.failureRateHint')}
              />
              <SummaryTile
                label={t('dashboard.peakDay')}
                value={shortDateLabel(peak.date, intl)}
                hint={t('dashboard.attempts', { count: fmt(peak.total) })}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
