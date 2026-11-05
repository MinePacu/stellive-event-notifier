import { type ReactNode } from 'react'
import { useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { KeyRound, RefreshCw, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import {
  DASHBOARD_AUTO_REFRESH_MS,
  usePreferencesStore,
} from '@/stores/preferences-store'
import { api, describeApiError, isApiError } from '@/lib/api'
import { intlLocale, useLocale, useT } from '@/lib/i18n'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { PageHeading } from '@/components/page-heading'
import { DeliveryQueueCard } from './components/delivery-queue-card'
import { ExternalApiCard } from './components/external-api-card'
import { LiveUptime } from './components/live-uptime'
import { StatusBadge } from './components/status-badge'
import {
  AdapterHealthCard,
  ConfigurationCard,
  RecentActivityCard,
  ServiceOverviewCard,
} from './components/system-status'
import { formatNumber } from './format'
import { useStateLabel } from './state-labels'
import { type AdminOverview } from './types'

const OVERVIEW_PATH = '/v1/internal/admin/overview'

function StatCard({
  title,
  value,
  hint,
}: {
  title: string
  value: ReactNode
  hint: string
}) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardDescription>{title}</CardDescription>
        <CardTitle className='text-2xl tabular-nums'>{value}</CardTitle>
      </CardHeader>
      <CardContent className='text-xs break-words text-muted-foreground'>
        {hint}
      </CardContent>
    </Card>
  )
}

function OverviewSkeleton() {
  return (
    <div className='space-y-4' aria-busy='true'>
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5'>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className='h-28' />
        ))}
      </div>
      <Skeleton className='h-72' />
      <Skeleton className='h-96' />
    </div>
  )
}

export function Dashboard() {
  const t = useT()
  const { locale } = useLocale()
  const intl = intlLocale(locale)
  const stateLabel = useStateLabel()
  const queryClient = useQueryClient()
  const autoRefresh = usePreferencesStore((state) => state.dashboardAutoRefresh)
  const setAutoRefresh = usePreferencesStore(
    (state) => state.setDashboardAutoRefresh
  )
  const hasToken = useAuthStore((state) => Boolean(state.internalToken))
  // Operations actions run while polling would race them; pause like the
  // legacy console did.
  const busy = useIsMutating({ mutationKey: ['operations'] }) > 0

  const overviewQuery = useQuery({
    queryKey: ['dashboard', 'overview', hasToken],
    queryFn: () => api.get<AdminOverview>(OVERVIEW_PATH),
    refetchInterval: autoRefresh && !busy ? DASHBOARD_AUTO_REFRESH_MS : false,
  })
  const overview = overviewQuery.data
  const tokenMissing =
    isApiError(overviewQuery.error) &&
    overviewQuery.error.code === 'internal_token_missing'

  const handleRefresh = async () => {
    const result = await overviewQuery.refetch()
    void queryClient.invalidateQueries({
      queryKey: ['dashboard', 'external-api-results'],
    })
    if (result.isError) toast.error(describeApiError(result.error))
    else toast.success(t('dashboard.refreshed'))
  }

  let autoRefreshStatus: string
  if (!autoRefresh) autoRefreshStatus = t('dashboard.off')
  else if (busy) autoRefreshStatus = t('dashboard.autoRefreshPaused')
  else if (overviewQuery.isError && overview)
    autoRefreshStatus = t('dashboard.retrying')
  else
    autoRefreshStatus = t('dashboard.autoRefreshEvery', {
      seconds: DASHBOARD_AUTO_REFRESH_MS / 1000,
    })

  const actions = (
    <>
      <div className='flex items-center gap-2'>
        <Switch
          id='dashboard-auto-refresh'
          checked={autoRefresh}
          onCheckedChange={setAutoRefresh}
        />
        <Label htmlFor='dashboard-auto-refresh'>
          {t('dashboard.autoRefresh')}
        </Label>
        <span className='text-xs text-muted-foreground' aria-live='polite'>
          {autoRefreshStatus}
        </span>
      </div>
      <Button
        variant='outline'
        size='sm'
        onClick={() => void handleRefresh()}
        disabled={overviewQuery.isFetching}
      >
        <RefreshCw className={overviewQuery.isFetching ? 'animate-spin' : ''} />
        {t('common.refresh')}
      </Button>
    </>
  )

  let body: ReactNode
  if (overviewQuery.isPending) {
    body = <OverviewSkeleton />
  } else if (!overview && tokenMissing) {
    body = (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <KeyRound className='size-5' />
            {t('dashboard.tokenRequiredTitle')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.tokenRequiredDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to='/settings'>{t('dashboard.openSettings')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  } else if (!overview) {
    body = (
      <Alert variant='destructive'>
        <TriangleAlert />
        <AlertTitle>{t('dashboard.loadFailed')}</AlertTitle>
        <AlertDescription>
          <p>{describeApiError(overviewQuery.error)}</p>
          <Button
            variant='outline'
            size='sm'
            className='mt-2'
            onClick={() => void overviewQuery.refetch()}
          >
            {t('common.refresh')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  } else {
    const reportedAt = overviewQuery.dataUpdatedAt
    body = (
      <div className='space-y-4'>
        {overviewQuery.isError ? (
          <Alert variant='destructive'>
            <TriangleAlert />
            <AlertTitle>{t('dashboard.loadFailed')}</AlertTitle>
            <AlertDescription>
              {describeApiError(overviewQuery.error)}
            </AlertDescription>
          </Alert>
        ) : null}
        <section
          className='grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5'
          aria-live='polite'
        >
          <StatCard
            title={t('dashboard.health')}
            value={<StatusBadge value={overview.database.status} />}
            hint={overview.service.name}
          />
          <StatCard
            title={t('dashboard.database')}
            value={stateLabel(overview.database.status)}
            hint={overview.database.reason || '-'}
          />
          <StatCard
            title={t('dashboard.uptime')}
            value={
              <LiveUptime
                seconds={overview.service.uptimeSeconds}
                reportedAt={reportedAt}
              />
            }
            hint={t('dashboard.serviceUptimeHint')}
          />
          <StatCard
            title={t('dashboard.queue')}
            value={
              overview.queue.queued == null
                ? '-'
                : formatNumber(overview.queue.queued, intl)
            }
            hint={t('dashboard.queueHint', {
              failed: overview.queue.failed ?? 0,
              missing: overview.queue.missingJobCount ?? 0,
            })}
          />
          <StatCard
            title={t('dashboard.events')}
            value={
              overview.recentDelivery.sent == null
                ? '-'
                : formatNumber(overview.recentDelivery.sent, intl)
            }
            hint={t('dashboard.eventsHint', {
              failed: overview.recentDelivery.failed ?? 0,
            })}
          />
        </section>
        <DeliveryQueueCard trend={overview.dailyDeliveryQueue} />
        <ExternalApiCard trend={overview.externalApiCalls?.daily} />
        <h2 className='pt-2 text-lg font-semibold'>
          {t('dashboard.systemStatus')}
        </h2>
        <div className='grid items-start gap-4 lg:grid-cols-2'>
          <ServiceOverviewCard overview={overview} reportedAt={reportedAt} />
          <RecentActivityCard overview={overview} />
          <AdapterHealthCard overview={overview} />
          <ConfigurationCard overview={overview} />
        </div>
      </div>
    )
  }

  return (
    <>
      <AppHeader />
      <Main>
        <PageHeading
          title={t('nav.dashboard')}
          description={t('dashboard.healthDescription')}
          actions={actions}
        />
        {body}
      </Main>
    </>
  )
}
