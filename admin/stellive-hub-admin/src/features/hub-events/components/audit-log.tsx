import { useQuery } from '@tanstack/react-query'
import { describeApiError } from '@/lib/api'
import { intlLocale, useLocale, useT } from '@/lib/i18n'
import { formatDateTime } from '../form'
import { hubEventKeys, listHubEventAuditLog } from '../hub-events-api'

/** Audit log for one saved event (legacy "Audit log" panel). */
export function AuditLog({ eventId }: { eventId?: string }) {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = intlLocale(locale)
  const query = useQuery({
    queryKey: hubEventKeys.auditLog(eventId ?? ''),
    queryFn: ({ signal }) => listHubEventAuditLog(eventId ?? '', signal),
    enabled: Boolean(eventId),
  })

  let body: React.ReactNode
  if (!eventId) {
    body = (
      <p className='text-sm text-muted-foreground'>
        {t('hubEvent.auditDescription')}
      </p>
    )
  } else if (query.isPending) {
    body = (
      <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
    )
  } else if (query.isError) {
    body = (
      <p className='text-sm text-destructive'>
        {describeApiError(query.error)}
      </p>
    )
  } else if (query.data.length === 0) {
    body = (
      <p className='text-sm text-muted-foreground'>
        {t('hubEvent.auditEmpty')}
      </p>
    )
  } else {
    body = (
      <ul id='hub-event-audit-log' className='grid gap-2 text-sm'>
        {query.data.map((entry) => (
          <li key={entry.id} className='grid gap-0.5 rounded-md border p-2'>
            <span className='break-words'>
              {[
                formatDateTime(entry.createdAt, dateLocale),
                entry.action,
                entry.actorId || t('hubEvent.auditUnknownActor'),
              ].join(' - ')}
            </span>
            {entry.reason ? (
              <span className='break-words text-muted-foreground'>
                {t('hubEvent.auditReason', { reason: entry.reason })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section aria-labelledby='hub-event-audit-title' className='grid gap-3'>
      <h3 id='hub-event-audit-title' className='font-semibold'>
        {t('hubEvent.auditLog')}
      </h3>
      {body}
    </section>
  )
}
