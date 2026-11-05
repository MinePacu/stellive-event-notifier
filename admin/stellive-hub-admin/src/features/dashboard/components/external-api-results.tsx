import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { api, describeApiError } from '@/lib/api'
import { intlLocale, useLocale, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime } from '../format'
import { type ExternalApiCallListResult } from '../types'

const ALL = 'all'
const SOURCES = ['youtube', 'chzzk', 'fcm', 'websub']
const RESULT_STATUSES = [
  'ok',
  'not_modified',
  'quota_exceeded',
  'rate_limited',
  'auth_required',
  'http_error',
  'network_error',
  'timeout',
  'parse_error',
]

export function ExternalApiResults() {
  const t = useT()
  const { locale } = useLocale()
  const intl = intlLocale(locale)
  const [source, setSource] = useState(ALL)
  const [resultStatus, setResultStatus] = useState(ALL)

  const query = useQuery({
    queryKey: ['dashboard', 'external-api-results', source, resultStatus],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' })
      if (source !== ALL) params.set('source', source)
      if (resultStatus !== ALL) params.set('resultStatus', resultStatus)
      return api.get<ExternalApiCallListResult>(
        `/v1/internal/admin/external-api-calls?${params.toString()}`
      )
    },
  })
  const items = query.data?.items ?? []

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div className='space-y-1'>
          <h3 className='font-semibold'>{t('dashboard.recentApiResults')}</h3>
          <p className='text-sm text-muted-foreground'>
            {t('dashboard.recentApiResultsDescription')}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger
              className='w-36'
              aria-label={t('dashboard.sourceFilter')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('dashboard.allSources')}</SelectItem>
              {SOURCES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={resultStatus} onValueChange={setResultStatus}>
            <SelectTrigger
              className='w-40'
              aria-label={t('dashboard.resultFilter')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('dashboard.allResults')}</SelectItem>
              {RESULT_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={query.isFetching ? 'animate-spin' : ''} />
            {t('dashboard.refreshResults')}
          </Button>
        </div>
      </div>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.time')}</TableHead>
              <TableHead>{t('common.source')}</TableHead>
              <TableHead>{t('common.operation')}</TableHead>
              <TableHead>{t('common.result')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead className='text-end'>{t('common.duration')}</TableHead>
              <TableHead className='text-end'>{t('dashboard.quota')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isError || items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='h-16 text-center whitespace-normal text-muted-foreground'
                >
                  {query.isError
                    ? describeApiError(query.error)
                    : query.isPending
                      ? t('common.loading')
                      : t('dashboard.noExternalResults')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className='whitespace-nowrap'>
                    {formatDateTime(item.requestedAt, intl)}
                  </TableCell>
                  <TableCell>{item.source || '-'}</TableCell>
                  <TableCell>{item.operation || '-'}</TableCell>
                  <TableCell>{item.resultStatus || '-'}</TableCell>
                  <TableCell>{item.statusCode ?? '-'}</TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {item.durationMs == null ? '-' : `${item.durationMs}ms`}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {item.quotaUnits ?? 0}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
