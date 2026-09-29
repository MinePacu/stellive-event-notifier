import { useQuery } from '@tanstack/react-query'
import { describeApiError } from '@/lib/api'
import { useLocale, useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { announcementsApi } from '../data/api'
import { formatDateTime } from '../data/format'

function Feedback({
  loading,
  error,
  empty,
}: {
  loading: boolean
  error: unknown
  empty: boolean
}) {
  const t = useT()
  if (loading) return <Skeleton className='h-16 w-full' />
  if (error) {
    return (
      <p role='alert' className='text-sm text-destructive'>
        {describeApiError(error)}
      </p>
    )
  }
  if (empty) {
    return (
      <p className='py-4 text-center text-sm text-muted-foreground'>
        {t('announcement.noHistory')}
      </p>
    )
  }
  return null
}

/** Audit log and push attempts of the selected announcement. */
export function AnnouncementHistory({ id }: { id: string }) {
  const t = useT()
  const { locale } = useLocale()
  const audit = useQuery({
    queryKey: ['announcements', id, 'audit-log'],
    queryFn: () => announcementsApi.auditLog(id),
  })
  const pushes = useQuery({
    queryKey: ['announcements', id, 'push-attempts'],
    queryFn: () => announcementsApi.pushAttempts(id),
  })
  const auditItems = audit.data ?? []
  const pushItems = pushes.data?.items ?? []
  const summary = Object.entries(pushes.data?.summary ?? {}).filter(
    ([, count]) => count > 0
  )

  return (
    <Card>
      <Tabs defaultValue='audit'>
        <CardHeader className='gap-3'>
          <CardTitle>{t('announcement.history')}</CardTitle>
          <TabsList>
            <TabsTrigger value='audit'>
              {t('announcement.auditLog')}
            </TabsTrigger>
            <TabsTrigger value='push'>
              {t('announcement.pushAttempts')}
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value='audit' className='grid gap-2'>
            <Feedback
              loading={audit.isPending}
              error={audit.error}
              empty={auditItems.length === 0}
            />
            {auditItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.time')}</TableHead>
                    <TableHead>{t('announcement.action')}</TableHead>
                    <TableHead>{t('announcement.actor')}</TableHead>
                    <TableHead>{t('common.reason')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditItems.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className='whitespace-nowrap'>
                        {formatDateTime(entry.createdAt, locale)}
                      </TableCell>
                      <TableCell>{entry.action}</TableCell>
                      <TableCell>
                        {entry.actorId ?? t('announcement.unknownActor')}
                      </TableCell>
                      <TableCell className='break-words whitespace-normal'>
                        {entry.reason ?? ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </TabsContent>
          <TabsContent value='push' className='grid gap-2'>
            {summary.length > 0 ? (
              <div className='flex flex-wrap gap-1'>
                {summary.map(([status, count]) => (
                  <Badge key={status} variant='outline'>
                    {status}: {count}
                  </Badge>
                ))}
              </div>
            ) : null}
            <Feedback
              loading={pushes.isPending}
              error={pushes.error}
              empty={pushItems.length === 0}
            />
            {pushItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.time')}</TableHead>
                    <TableHead>{t('announcement.topic')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>{t('announcement.errorCode')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pushItems.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className='whitespace-nowrap'>
                        {formatDateTime(entry.requestedAt, locale)}
                      </TableCell>
                      <TableCell className='max-w-56 truncate'>
                        {entry.topic ?? entry.eventId ?? ''}
                      </TableCell>
                      <TableCell>{entry.status}</TableCell>
                      <TableCell>{entry.providerErrorCode ?? ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
