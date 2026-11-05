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
import { Separator } from '@/components/ui/separator'
import {
  formatNumber,
  formatPercent,
  numericValue,
  shortDateLabel,
} from '../format'
import { type ExternalApiCallTrend, KNOWN_API_SOURCES } from '../types'
import { CHART_AXIS_PROPS, sourceColor } from './chart-colors'
import { ChartLegend, ChartTooltipBox, ChartTooltipRow } from './chart-parts'
import { ExternalApiResults } from './external-api-results'
import { SummaryTile } from './summary-tile'

type Datum = {
  date: string
  label: string
  total: number
  quotaUnits: number
  bySource: Record<string, number>
  // One numeric field per visible source so recharts can stack them.
  [source: string]: number | string | Record<string, number>
}

export function ExternalApiCard({
  trend,
}: {
  trend: ExternalApiCallTrend | undefined
}) {
  const t = useT()
  const { locale } = useLocale()
  const intl = intlLocale(locale)
  const fmt = (value: number) => formatNumber(value, intl)
  const items = trend && Array.isArray(trend.items) ? trend.items : []
  const totals = trend?.totals
  const bySourceTotals = totals?.bySource ?? {}

  // Busiest sources first; fall back to the known set when nothing was recorded.
  const recorded = Object.keys(bySourceTotals).sort(
    (a, b) => numericValue(bySourceTotals[b]) - numericValue(bySourceTotals[a])
  )
  const visibleSources = recorded.length > 0 ? recorded : [...KNOWN_API_SOURCES]

  const data: Datum[] = items.map((item) => {
    const row: Datum = {
      date: item.date,
      label: shortDateLabel(item.date, intl),
      total: numericValue(item.total),
      quotaUnits: numericValue(item.quotaUnits),
      bySource: item.bySource ?? {},
    }
    for (const source of visibleSources) {
      row[`s:${source}`] = numericValue(item.bySource?.[source])
    }
    return row
  })
  const today = data[data.length - 1]
  const days = trend?.days || data.length || 14

  const tooltipSources = (item: Datum) =>
    Array.from(new Set<string>([...KNOWN_API_SOURCES, ...visibleSources])).sort(
      (a, b) =>
        numericValue(item.bySource[b]) - numericValue(item.bySource[a]) ||
        a.localeCompare(b)
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.externalApiCalls')}</CardTitle>
        <CardDescription>
          {t('dashboard.externalApiDescription')}
        </CardDescription>
        <p className='text-xs text-muted-foreground'>
          {t('dashboard.quotaNote')}
        </p>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]'>
          <div className='min-w-0 space-y-3'>
            {data.length === 0 ? (
              <div className='flex h-56 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground'>
                {t('dashboard.noExternalCalls')}
              </div>
            ) : (
              <div role='img' aria-label={t('dashboard.apiChartLabel')}>
                <ResponsiveContainer width='100%' height={224}>
                  <BarChart
                    data={data}
                    margin={{ top: 4, right: 4, left: -16 }}
                  >
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
                            <ChartTooltipRow
                              strong
                              label={t('dashboard.totalCalls')}
                              value={fmt(item.total)}
                            />
                            {tooltipSources(item).map((source) => (
                              <ChartTooltipRow
                                key={source}
                                color={sourceColor(source)}
                                label={source}
                                value={fmt(numericValue(item.bySource[source]))}
                              />
                            ))}
                          </ChartTooltipBox>
                        )
                      }}
                    />
                    {visibleSources.map((source) => (
                      <Bar
                        key={source}
                        dataKey={`s:${source}`}
                        stackId='a'
                        fill={sourceColor(source)}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <ul className='sr-only'>
                  {data.map((item) => (
                    <li key={item.date}>
                      {t('dashboard.apiBarLabel', {
                        date: item.date,
                        count: item.total,
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ChartLegend
              label={t('dashboard.externalApiCalls')}
              items={visibleSources.map((source) => ({
                key: source,
                label: source,
                color: sourceColor(source),
              }))}
            />
          </div>
          <div className='grid grid-cols-2 gap-3 self-start lg:grid-cols-1'>
            <SummaryTile
              label={t('dashboard.todayTotal')}
              value={numericValue(today?.total)}
              hint={t('dashboard.todayTotalHint')}
            />
            <SummaryTile
              label={t('dashboard.successRate')}
              value={formatPercent(totals?.ok ?? 0, totals?.total ?? 0)}
              hint={t('dashboard.successRateHint')}
            />
            <SummaryTile
              label={t('dashboard.quotaToday')}
              value={numericValue(today?.quotaUnits)}
              hint={t('dashboard.quotaTodayHint')}
            />
            <SummaryTile
              label={t('dashboard.quotaWindow', { days })}
              value={numericValue(totals?.quotaUnits)}
              hint={t('dashboard.quotaWindowHint', { days })}
            />
          </div>
        </div>
        <Separator />
        <ExternalApiResults />
      </CardContent>
    </Card>
  )
}
