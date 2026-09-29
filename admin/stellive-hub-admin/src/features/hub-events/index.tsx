import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Plus, RefreshCw } from 'lucide-react'
import { usePreferencesStore } from '@/stores/preferences-store'
import { describeApiError } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { PageHeading } from '@/components/page-heading'
import { HubEventEditor } from './components/hub-event-editor'
import { HubEventFilters } from './components/hub-event-filters'
import { HubEventTable } from './components/hub-event-table'
import { hubEventKeys, listHubEvents } from './hub-events-api'
import {
  type AdminHubEvent,
  DEFAULT_HUB_EVENT_FILTERS,
  type HubEventListFilters,
} from './types'

/** Debounce for the free-text filters (same as the legacy console). */
const TEXT_FILTER_DEBOUNCE_MS = 250

type PageState = { cursor: string; previousCursors: string[]; page: number }
const FIRST_PAGE: PageState = { cursor: '', previousCursors: [], page: 1 }

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function HubEvents() {
  const t = useT()
  const pageSize = usePreferencesStore((state) => state.hubEventPageSize)
  const [draftFilters, setDraftFilters] = useState<HubEventListFilters>(
    DEFAULT_HUB_EVENT_FILTERS
  )
  const [pageState, setPageState] = useState<PageState>(FIRST_PAGE)
  const [editor, setEditor] = useState<{
    key: number
    event: AdminHubEvent | null
  } | null>(null)
  const [selectedId, setSelectedId] = useState<string | undefined>()

  const generationId = useDebounced(
    draftFilters.generationId,
    TEXT_FILTER_DEBOUNCE_MS
  )
  const memberId = useDebounced(draftFilters.memberId, TEXT_FILTER_DEBOUNCE_MS)
  const query = useDebounced(draftFilters.query, TEXT_FILTER_DEBOUNCE_MS)
  const filters: HubEventListFilters = {
    ...draftFilters,
    generationId,
    memberId,
    query,
  }
  const filterSignature = JSON.stringify([filters, pageSize])

  // Any filter or page size change goes back to the first page.
  const [lastSignature, setLastSignature] = useState(filterSignature)
  if (lastSignature !== filterSignature) {
    setLastSignature(filterSignature)
    setPageState(FIRST_PAGE)
  }

  const listQuery = useQuery({
    queryKey: hubEventKeys.list(filters, pageState.cursor, pageSize),
    queryFn: ({ signal }) =>
      listHubEvents(filters, pageState.cursor, pageSize, signal),
    placeholderData: keepPreviousData,
  })
  const events = listQuery.data?.items ?? []
  const nextCursor = listQuery.data?.nextCursor ?? ''

  const refresh = () => {
    if (pageState.cursor) setPageState(FIRST_PAGE)
    else void listQuery.refetch()
  }

  const openEditor = (event: AdminHubEvent | null) => {
    setSelectedId(event?.id)
    setEditor((previous) => ({ key: (previous?.key ?? 0) + 1, event }))
  }

  return (
    <>
      <AppHeader />
      <Main>
        <PageHeading
          title={t('nav.hubEvents')}
          description={t('hubEvent.goodsControls')}
          actions={
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={refresh}
                    disabled={listQuery.isFetching}
                  >
                    <RefreshCw
                      className={
                        listQuery.isFetching ? 'animate-spin' : undefined
                      }
                    />
                    {t('hubEvent.refreshEvents')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('hubEvent.refreshTooltip')}</TooltipContent>
              </Tooltip>
              <Button type='button' onClick={() => openEditor(null)}>
                <Plus />
                {t('hubEvent.create')}
              </Button>
            </>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>{t('hubEvent.events')}</CardTitle>
            <CardDescription>{t('hubEvent.filterHelp')}</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-4'>
            <HubEventFilters
              filters={draftFilters}
              onChange={(patch) =>
                setDraftFilters((previous) => ({ ...previous, ...patch }))
              }
            />
            <HubEventTable
              events={events}
              loading={listQuery.isPending || listQuery.isFetching}
              errorMessage={
                listQuery.isError
                  ? describeApiError(listQuery.error)
                  : undefined
              }
              selectedId={editor ? selectedId : undefined}
              onSelect={openEditor}
              page={pageState.page}
              hasPrevious={pageState.previousCursors.length > 0}
              hasNext={Boolean(nextCursor)}
              onPrevious={() =>
                setPageState((previous) => {
                  if (previous.previousCursors.length === 0) return previous
                  const previousCursors = previous.previousCursors.slice(0, -1)
                  return {
                    cursor:
                      previous.previousCursors[
                        previous.previousCursors.length - 1
                      ] ?? '',
                    previousCursors,
                    page: Math.max(1, previous.page - 1),
                  }
                })
              }
              onNext={() => {
                if (!nextCursor) return
                setPageState((previous) => ({
                  cursor: nextCursor,
                  previousCursors: [
                    ...previous.previousCursors,
                    previous.cursor,
                  ],
                  page: previous.page + 1,
                }))
              }}
            />
          </CardContent>
        </Card>
        {editor ? (
          <HubEventEditor
            key={editor.key}
            initialEvent={editor.event}
            onCurrentChange={(event) => setSelectedId(event?.id)}
            onClose={() => setEditor(null)}
          />
        ) : null}
      </Main>
    </>
  )
}
