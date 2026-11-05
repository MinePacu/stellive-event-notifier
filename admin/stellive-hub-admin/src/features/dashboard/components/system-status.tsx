import { type ReactNode } from 'react'
import { intlLocale, useLocale, useT } from '@/lib/i18n'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatDeliveryState,
  formatLastChecked,
  formatQueueState,
  summarizeAdapters,
  summarizeSecrets,
} from '../format'
import { type AdminOverview } from '../types'
import { LiveUptime } from './live-uptime'
import { StatusBadge } from './status-badge'

function Bordered({ children }: { children: ReactNode }) {
  return <div className='rounded-md border'>{children}</div>
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className='h-16 text-center text-muted-foreground'
      >
        {text}
      </TableCell>
    </TableRow>
  )
}

function SummaryRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className='flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0'>
      <div className='min-w-0 space-y-0.5'>
        <div className='text-sm font-medium'>{title}</div>
        <div className='text-xs text-muted-foreground'>{description}</div>
      </div>
      <div className='text-sm font-semibold'>{children}</div>
    </div>
  )
}

type Props = { overview: AdminOverview; reportedAt: number }

export function ServiceOverviewCard({ overview, reportedAt }: Props) {
  const t = useT()
  const uptime = (
    <LiveUptime
      seconds={overview.service.uptimeSeconds}
      reportedAt={reportedAt}
    />
  )
  const rows: { name: string; value: ReactNode; note: string }[] = [
    {
      name: t('dashboard.database'),
      value: <StatusBadge value={overview.database.status} />,
      note: overview.database.reason || '-',
    },
    {
      name: t('dashboard.uptime'),
      value: uptime,
      note: t('dashboard.liveTickHint'),
    },
    {
      name: t('dashboard.secrets'),
      value: summarizeSecrets(overview.secrets, t),
      note: t('dashboard.secretsHint'),
    },
    {
      name: t('dashboard.pushDelivery'),
      value: formatDeliveryState(overview.recentDelivery, t),
      note: t('dashboard.pushDeliveryHint'),
    },
    {
      name: t('dashboard.adapterSummary'),
      value: summarizeAdapters(overview.adapters, t),
      note: t('dashboard.adapterDiagnostics'),
    },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.serviceOverview')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='divide-y'>
          <SummaryRow
            title={t('dashboard.service')}
            description={t('dashboard.serviceHint')}
          >
            {overview.service.name}
          </SummaryRow>
          <SummaryRow
            title={t('dashboard.environment')}
            description={t('dashboard.environmentHint')}
          >
            {overview.service.environment}
          </SummaryRow>
          <SummaryRow
            title={t('dashboard.uptime')}
            description={t('dashboard.uptimeHint')}
          >
            {uptime}
          </SummaryRow>
          <SummaryRow
            title={t('dashboard.queueState')}
            description={t('dashboard.queueStateHint')}
          >
            {formatQueueState(overview.queue, t)}
          </SummaryRow>
          <SummaryRow
            title={t('dashboard.deliveryState')}
            description={t('dashboard.deliveryStateHint')}
          >
            {formatDeliveryState(overview.recentDelivery, t)}
          </SummaryRow>
        </div>
        <Bordered>
          <Table>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className='font-medium'>{row.name}</TableCell>
                  <TableCell>{row.value}</TableCell>
                  <TableCell className='whitespace-normal text-muted-foreground'>
                    {row.note}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Bordered>
      </CardContent>
    </Card>
  )
}

export function RecentActivityCard({ overview }: { overview: AdminOverview }) {
  const t = useT()
  const items = [
    {
      title: t('dashboard.overviewRefreshedTitle'),
      description: t('dashboard.overviewRefreshedHint'),
    },
    {
      title: t('dashboard.queueState'),
      description: formatQueueState(overview.queue, t),
    },
    {
      title: t('dashboard.deliveryState'),
      description: formatDeliveryState(overview.recentDelivery, t),
    },
    {
      title: t('dashboard.adapterDiagnostics'),
      description: summarizeAdapters(overview.adapters, t),
    },
    {
      title: t('dashboard.secretsReadiness'),
      description: summarizeSecrets(overview.secrets, t),
    },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('audit.recent')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className='divide-y'>
          {items.map((item) => (
            <li key={item.title} className='py-3 first:pt-0 last:pb-0'>
              <div className='text-sm font-medium'>{item.title}</div>
              <div className='text-sm text-muted-foreground'>
                {item.description}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function AdapterHealthCard({ overview }: { overview: AdminOverview }) {
  const t = useT()
  const { locale } = useLocale()
  const intl = intlLocale(locale)
  const adapters = overview.adapters ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.adapterHealth')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Bordered>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.source')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('common.reason')}</TableHead>
                <TableHead>{t('dashboard.lastChecked')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adapters.length === 0 ? (
                <EmptyRow colSpan={4} text={t('dashboard.noAdapters')} />
              ) : (
                adapters.map((adapter) => (
                  <TableRow key={adapter.source}>
                    <TableCell className='font-medium'>
                      {adapter.source}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={adapter.status} />
                    </TableCell>
                    <TableCell className='whitespace-normal'>
                      {adapter.reason || '-'}
                    </TableCell>
                    <TableCell className='text-xs'>
                      {formatLastChecked(adapter.lastCheckedAt, intl, t)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Bordered>
      </CardContent>
    </Card>
  )
}

export function ConfigurationCard({ overview }: { overview: AdminOverview }) {
  const t = useT()
  const secrets = Object.entries(overview.secrets ?? {}).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  const flags = Object.entries(overview.featureFlags ?? {}).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.configuration')}</CardTitle>
        <CardDescription>{t('dashboard.secretsHint')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Bordered>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('common.state')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.length === 0 ? (
                <EmptyRow colSpan={2} text={t('dashboard.noSecrets')} />
              ) : (
                secrets.map(([name, value]) => (
                  <TableRow key={name}>
                    <TableCell className='font-mono text-xs'>{name}</TableCell>
                    <TableCell>
                      <StatusBadge value={value} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Bordered>
        <Bordered>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('common.value')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.length === 0 ? (
                <EmptyRow colSpan={2} text={t('dashboard.noFlags')} />
              ) : (
                flags.map(([name, value]) => (
                  <TableRow key={name}>
                    <TableCell className='font-mono text-xs'>{name}</TableCell>
                    <TableCell>
                      {typeof value === 'boolean' ? (
                        <StatusBadge value={value ? 'enabled' : 'disabled'} />
                      ) : (
                        String(value)
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Bordered>
      </CardContent>
    </Card>
  )
}
