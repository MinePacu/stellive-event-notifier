import { ChevronLeft, ChevronRight } from 'lucide-react'
import { intlLocale, type MessageKey, useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  categoryLabelKeys,
  formatDateTime,
  labelKey,
  publicationStateLabelKeys,
  statusLabelKeys,
} from '../form'
import { type AdminHubEvent } from '../types'

type HubEventTableProps = {
  events: AdminHubEvent[]
  loading: boolean
  errorMessage?: string
  selectedId?: string
  onSelect: (event: AdminHubEvent) => void
  page: number
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
}

export function PublicationStateBadge({ state }: { state?: string }) {
  const t = useT()
  const key = labelKey(publicationStateLabelKeys, state || 'draft')
  const variant =
    state === 'published'
      ? 'default'
      : state === 'deleted'
        ? 'destructive'
        : state === 'inactive'
          ? 'outline'
          : 'secondary'
  return <Badge variant={variant}>{key ? t(key) : state}</Badge>
}

export function HubEventTable({
  events,
  loading,
  errorMessage,
  selectedId,
  onSelect,
  page,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: HubEventTableProps) {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = intlLocale(locale)
  const label = (map: Record<string, MessageKey>, v?: string) => {
    const key = labelKey(map, v)
    return key ? t(key) : (v ?? '')
  }

  let emptyText: string | null = null
  if (errorMessage) emptyText = errorMessage
  else if (loading && events.length === 0) emptyText = t('common.loading')
  else if (events.length === 0) emptyText = t('hubEvent.none')

  return (
    <div className='grid gap-3'>
      <div className='overflow-hidden rounded-md border'>
        <Table aria-label={t('nav.hubEvents')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('hubEvent.title')}</TableHead>
              <TableHead>{t('hubEvent.publicationState')}</TableHead>
              <TableHead className='hidden md:table-cell'>
                {t('hubEvent.category')}
              </TableHead>
              <TableHead className='hidden sm:table-cell'>
                {t('hubEvent.publicStatus')}
              </TableHead>
              <TableHead className='hidden lg:table-cell'>
                {t('hubEvent.scope')}
              </TableHead>
              <TableHead className='hidden lg:table-cell'>
                {t('hubEvent.updated')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody
            className={cn(loading && events.length > 0 && 'opacity-60')}
          >
            {emptyText ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className={cn(
                    'h-24 text-center whitespace-normal text-muted-foreground',
                    errorMessage && 'text-destructive'
                  )}
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => {
                const selected = event.id === selectedId
                return (
                  <TableRow
                    key={event.id}
                    data-state={selected ? 'selected' : undefined}
                    tabIndex={0}
                    className='cursor-pointer'
                    onClick={() => onSelect(event)}
                    onKeyDown={(keyboardEvent) => {
                      if (
                        keyboardEvent.key === 'Enter' ||
                        keyboardEvent.key === ' '
                      ) {
                        keyboardEvent.preventDefault()
                        onSelect(event)
                      }
                    }}
                  >
                    <TableCell className='max-w-[16rem] whitespace-normal sm:max-w-md'>
                      <div className='flex flex-wrap items-center gap-1.5'>
                        <span className='font-medium break-words'>
                          {event.title || t('hubEvent.untitled')}
                        </span>
                        {Array.isArray(event.tags) &&
                        event.tags.includes('album') ? (
                          <Badge variant='outline'>{t('hubEvent.album')}</Badge>
                        ) : null}
                      </div>
                      <div className='text-xs text-muted-foreground lg:hidden'>
                        {[
                          event.generationId,
                          event.memberId,
                          formatDateTime(event.updatedAt, dateLocale),
                        ]
                          .filter(Boolean)
                          .join(' / ')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PublicationStateBadge state={event.publicationState} />
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>
                      {label(categoryLabelKeys, event.category) || '-'}
                    </TableCell>
                    <TableCell className='hidden sm:table-cell'>
                      {label(statusLabelKeys, event.status) || '-'}
                    </TableCell>
                    <TableCell className='hidden lg:table-cell'>
                      {[event.generationId, event.memberId]
                        .filter(Boolean)
                        .join(' / ') || '-'}
                    </TableCell>
                    <TableCell className='hidden text-muted-foreground lg:table-cell'>
                      {formatDateTime(event.updatedAt, dateLocale) || '-'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <nav
        aria-label={t('hubEvent.pagination')}
        className='flex flex-wrap items-center justify-between gap-2'
      >
        <span className='text-sm text-muted-foreground'>
          {t('hubEvent.pageStatus', { page, count: events.length })}
        </span>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onPrevious}
            disabled={!hasPrevious || loading}
          >
            <ChevronLeft />
            {t('hubEvent.previous')}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onNext}
            disabled={!hasNext || loading}
          >
            {t('hubEvent.next')}
            <ChevronRight />
          </Button>
        </div>
      </nav>
    </div>
  )
}
