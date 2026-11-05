import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleAlert, CircleCheck, Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { api, describeApiError } from '@/lib/api'
import { intlLocale, type MessageKey, useLocale, useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { PageHeading } from '@/components/page-heading'

type OperationId =
  | 'drain'
  | 'renewYoutube'
  | 'pollChzzk'
  | 'recalculate'
  | 'prune'

type Operation = {
  id: OperationId
  title: MessageKey
  description: MessageKey
  button: MessageKey
  path: string
  body?: unknown
  /** Destructive actions ask for confirmation first. */
  confirm?: boolean
}

// Endpoints and payloads are the same as the legacy console. Everything under
// /v1/internal/* uses the token from Settings; recalculate uses the admin session.
const OPERATIONS: Operation[] = [
  {
    id: 'drain',
    title: 'dashboard.queue',
    description: 'operations.drainDescription',
    button: 'operations.drainJobs',
    path: '/v1/internal/jobs/notifications/drain',
    body: { limit: 25 },
  },
  {
    id: 'renewYoutube',
    title: 'operations.youtubeScheduler',
    description: 'operations.renewDescription',
    button: 'operations.renewYoutube',
    path: '/v1/internal/schedulers/youtube/renew-subscriptions',
  },
  {
    id: 'pollChzzk',
    title: 'operations.chzzkLive',
    description: 'operations.pollDescription',
    button: 'operations.pollChzzk',
    path: '/v1/internal/schedulers/chzzk/live-status',
  },
  {
    id: 'recalculate',
    title: 'hubEvent.specialDayStatus',
    description: 'operations.recalculateDescription',
    button: 'operations.recalculate',
    path: '/v1/admin/hub-events/special-days/recalculate-status',
  },
  {
    id: 'prune',
    title: 'dashboard.externalApiLogs',
    description: 'operations.pruneDescription',
    button: 'operations.pruneLogs',
    path: '/v1/internal/admin/external-api-calls/prune',
    confirm: true,
  },
]

type LastResult = {
  label: string
  ok: boolean
  at: Date
  message: string
  response?: string
}

function responseStatus(result: unknown): string {
  if (result && typeof result === 'object' && 'status' in result) {
    return String((result as { status: unknown }).status)
  }
  return 'ok'
}

function prettyResponse(result: unknown): string | undefined {
  if (result === undefined || result === null || result === '') return undefined
  return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
}

export function Operations() {
  const t = useT()
  const { locale } = useLocale()
  const queryClient = useQueryClient()
  const [last, setLast] = useState<LastResult | null>(null)
  const [pending, setPending] = useState<Operation | null>(null)
  const [confirming, setConfirming] = useState<Operation | null>(null)

  // Failures are toasted by the app-wide mutation error handler.
  const mutation = useMutation({
    mutationKey: ['operations'],
    mutationFn: (operation: Operation) =>
      api.post<unknown>(operation.path, operation.body),
    onMutate: (operation) => setPending(operation),
    onSuccess: (result, operation) => {
      const label = t(operation.button)
      const message = t('operations.completedWithStatus', {
        action: label,
        status: responseStatus(result),
      })
      toast.success(message)
      setLast({
        label,
        ok: true,
        at: new Date(),
        message,
        response: prettyResponse(result),
      })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error, operation) => {
      setLast({
        label: t(operation.button),
        ok: false,
        at: new Date(),
        message: describeApiError(error),
      })
    },
    onSettled: () => setPending(null),
  })

  const running = mutation.isPending

  const start = (operation: Operation) => {
    if (operation.confirm) setConfirming(operation)
    else mutation.mutate(operation)
  }

  const stateRows: [string, string][] = [
    [t('dashboard.adminSession'), t('status.required')],
    [t('operations.internalBearerToken'), t('settings.settingsOnly')],
    [t('settings.secretExposure'), t('settings.neverShown')],
    [t('common.actionResult'), t('settings.shownStatus')],
  ]

  return (
    <>
      <AppHeader />
      <Main>
        <PageHeading
          title={t('nav.operations')}
          description={t('operations.description')}
        />
        <div className='grid items-start gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>{t('operations.schedulersJobs')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className='divide-y'>
                {OPERATIONS.map((operation) => (
                  <li
                    key={operation.id}
                    className='flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between'
                  >
                    <div className='min-w-0 space-y-0.5'>
                      <div className='text-sm font-medium'>
                        {t(operation.title)}
                      </div>
                      <div className='text-sm text-muted-foreground'>
                        {t(operation.description)}
                      </div>
                    </div>
                    <Button
                      variant='outline'
                      size='sm'
                      className='shrink-0 self-start sm:self-auto'
                      disabled={running}
                      onClick={() => start(operation)}
                    >
                      {pending?.id === operation.id ? (
                        <Loader2 className='animate-spin' />
                      ) : (
                        <Play />
                      )}
                      {t(operation.button)}
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('operations.runState')}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='rounded-md border'>
                <Table>
                  <TableBody>
                    {stateRows.map(([name, value]) => (
                      <TableRow key={name}>
                        <TableCell className='font-medium'>{name}</TableCell>
                        <TableCell>{value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className='space-y-1 rounded-md border p-3'>
                <div className='text-sm font-medium'>
                  {t('settings.credentialBoundary')}
                </div>
                <p className='text-sm text-muted-foreground'>
                  {t('operations.tokenDescription')}
                </p>
                <Button asChild variant='link' size='sm' className='h-auto p-0'>
                  <Link to='/settings'>{t('dashboard.openSettings')}</Link>
                </Button>
              </div>
              <div className='space-y-2' aria-live='polite'>
                <div className='text-sm font-medium'>
                  {t('operations.lastResult')}
                </div>
                {running && pending ? (
                  <p className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Loader2 className='size-4 animate-spin' />
                    {t('operations.inProgress', { action: t(pending.button) })}
                  </p>
                ) : last ? (
                  <div className='space-y-2 rounded-md border p-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge
                        variant={last.ok ? 'secondary' : 'destructive'}
                        className='gap-1'
                      >
                        {last.ok ? <CircleCheck /> : <CircleAlert />}
                        {last.ok
                          ? t('operations.resultSucceeded')
                          : t('operations.resultFailed')}
                      </Badge>
                      <span className='text-sm font-medium'>{last.label}</span>
                      <span className='text-xs text-muted-foreground'>
                        {last.at.toLocaleTimeString(intlLocale(locale))}
                      </span>
                    </div>
                    <p className='text-sm break-words'>{last.message}</p>
                    {last.response ? (
                      <pre
                        className='max-h-48 overflow-auto rounded bg-muted p-2 text-xs'
                        aria-label={t('operations.response')}
                      >
                        {last.response}
                      </pre>
                    ) : null}
                  </div>
                ) : (
                  <CardDescription>
                    {t('operations.noResultYet')}
                  </CardDescription>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </Main>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
        title={t('operations.pruneConfirmTitle')}
        desc={t('operations.pruneConfirmDescription')}
        confirmText={t('operations.pruneLogs')}
        destructive
        handleConfirm={() => {
          const operation = confirming
          setConfirming(null)
          if (operation) mutation.mutate(operation)
        }}
      />
    </>
  )
}
