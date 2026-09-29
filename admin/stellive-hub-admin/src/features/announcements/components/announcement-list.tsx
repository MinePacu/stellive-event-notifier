import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { describeApiError } from '@/lib/api'
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { announcementsApi } from '../data/api'
import { formatDateTime } from '../data/format'
import {
  type Announcement,
  PUBLICATION_STATES,
  type PublicationState,
  STATE_LABEL_KEYS,
} from '../data/types'
import { AnnouncementBadges } from './announcement-badges'

export type StateFilter = PublicationState | 'all'

type AnnouncementListProps = {
  filter: StateFilter
  onFilterChange: (filter: StateFilter) => void
  selectedId: string | undefined
  onSelect: (item: Announcement) => void
}

export function AnnouncementList({
  filter,
  onFilterChange,
  selectedId,
  onSelect,
}: AnnouncementListProps) {
  const t = useT()
  const { locale } = useLocale()
  const query = useInfiniteQuery({
    queryKey: ['announcements', 'list', filter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      announcementsApi.list(filter === 'all' ? undefined : filter, pageParam),
    getNextPageParam: (page) => page.nextCursor,
  })
  const items = query.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('announcement.listAction')}</CardTitle>
        <div className='grid gap-1.5 pt-2'>
          <Label htmlFor='announcement-state-filter'>
            {t('announcement.publicationState')}
          </Label>
          <Select
            value={filter}
            onValueChange={(value) => onFilterChange(value as StateFilter)}
          >
            <SelectTrigger id='announcement-state-filter' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('announcement.all')}</SelectItem>
              {PUBLICATION_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {t(STATE_LABEL_KEYS[state])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className='grid gap-2'>
        {query.isPending ? (
          <>
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-16 w-full' />
          </>
        ) : query.isError ? (
          <p role='alert' className='text-sm text-destructive'>
            {describeApiError(query.error)}
          </p>
        ) : items.length === 0 ? (
          <p className='py-6 text-center text-sm text-muted-foreground'>
            {t('announcement.none')}
          </p>
        ) : (
          <ul className='grid gap-2' role='list'>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type='button'
                  onClick={() => onSelect(item)}
                  aria-current={item.id === selectedId}
                  className={cn(
                    'grid w-full gap-1.5 rounded-md border p-3 text-start transition-colors hover:bg-accent',
                    item.id === selectedId && 'border-primary bg-accent'
                  )}
                >
                  <strong className='line-clamp-2 text-sm font-medium break-words'>
                    {item.title || t('announcement.untitled')}
                  </strong>
                  <AnnouncementBadges item={item} />
                  <span className='text-xs text-muted-foreground'>
                    {formatDateTime(item.updatedAt, locale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.hasNextPage ? (
          <Button
            type='button'
            variant='outline'
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? (
              <Loader2 className='animate-spin' />
            ) : null}
            {t('announcement.loadMore')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
